import { Effect, Option, Schema } from "effect";
import { compactVerify, decodeJwt, decodeProtectedHeader } from "jose";
import { CertificateError, VerificationError, VerificationStatus } from "../errors/index.ts";
import { AppStoreServerSdk } from "../sdk.ts";
import {
  AppTransactionSchema,
  DecodedRealtimeRequestBodySchema,
  type AppTransaction,
  type DecodedRealtimeRequestBody,
  Environment,
  JWSRenewalInfoDecodedPayloadSchema,
  JWSTransactionDecodedPayloadSchema,
  ResponseBodyV2DecodedPayloadSchema,
  type JWSRenewalInfoDecodedPayload,
  type JWSTransactionDecodedPayload,
  type ResponseBodyV2DecodedPayload,
} from "../schemas/index.ts";
import {
  extractCertificateChain,
  getPublicKeyFromChain,
  validateCertificateChain,
  type CertificateChainValidationConfig,
} from "./certificate-chain.ts";

type DecodableSchema<T> = Schema.Top & {
  readonly Type: T;
  readonly DecodingServices: never;
};

/**
 * Configuration for a per-tenant {@link SignedDataVerifier}.
 */
export interface SignedDataVerifierConfig {
  /** Apple root certificates in PEM format. */
  rootCertificates: string[];
  /** Whether to enable online checks (OCSP). */
  enableOnlineChecks: boolean;
  /** The expected environment (Production, Sandbox, LocalTesting, Xcode). */
  environment: (typeof Environment)[keyof typeof Environment];
  /** Your app's bundle ID for validation. */
  bundleId: string;
  /**
   * Your app's Apple ID. When provided in production, the verifier asserts
   * decoded payloads match it; when omitted, the appAppleId check is skipped.
   */
  appAppleId: Option.Option<number>;
  /**
   * Optional override for notification verification — mirrors the upstream
   * `verifyNotification(bundleId, appAppleId, environment)` hook so tests
   * can inspect the extracted identifiers without running the strict checks.
   * Throwing (or failing the returned Effect) signals verification failure.
   */
  verifyNotificationOverride: Option.Option<
    (
      bundleId: Option.Option<string>,
      appAppleId: Option.Option<number>,
      environment: Option.Option<string>,
    ) => Effect.Effect<void, VerificationError> | void
  >;
}

/**
 * Per-tenant JWS signature verifier. Construct via {@link SignedDataVerifier.make}.
 */
export interface SignedDataVerifier {
  /** Verify and decode a signed transaction. */
  readonly verifyAndDecodeTransaction: (
    signedTransaction: string,
  ) => Effect.Effect<JWSTransactionDecodedPayload, VerificationError | CertificateError>;

  /** Verify and decode signed renewal info. */
  readonly verifyAndDecodeRenewalInfo: (
    signedRenewalInfo: string,
  ) => Effect.Effect<JWSRenewalInfoDecodedPayload, VerificationError | CertificateError>;

  /** Verify and decode a signed notification. */
  readonly verifyAndDecodeNotification: (
    signedPayload: string,
  ) => Effect.Effect<ResponseBodyV2DecodedPayload, VerificationError | CertificateError>;

  /** Verify and decode a signed AppTransaction. */
  readonly verifyAndDecodeAppTransaction: (
    signedAppTransaction: string,
  ) => Effect.Effect<AppTransaction, VerificationError | CertificateError>;

  /** Verify and decode a signed realtime retention request. */
  readonly verifyAndDecodeRealtimeRequest: (
    signedPayload: string,
  ) => Effect.Effect<DecodedRealtimeRequestBody, VerificationError | CertificateError>;
}

/**
 * Apple encodes the environment in the external purchase id prefix: sandbox
 * tokens start with `SANDBOX`, everything else is production.
 */
const environmentFromExternalPurchaseId = (externalPurchaseId: string): string => {
  if (externalPurchaseId.startsWith("SANDBOX")) return Environment.SANDBOX;
  return Environment.PRODUCTION;
};

const makeVerificationError = (status: VerificationStatus): VerificationError =>
  new VerificationError({ status, cause: Option.none() });

const asOption = <T>(value: Option.Option<T> | T | null | undefined): Option.Option<T> => {
  if (Option.isOption(value)) return value;
  return Option.fromNullishOr(value);
};

export const SignedDataVerifier = {
  /**
   * Build a per-tenant signature verifier. The {@link AppStoreServerSdk}
   * parameter exists for API symmetry with {@link AppStoreServerSdkClient}; the
   * verifier itself is pure (no HTTP), but accepting the SDK keeps room for
   * future shared state (parsed-certificate cache, OCSP cache, etc.).
   */
  make: (
    // The SDK handle is accepted for API symmetry with `AppStoreServerSdkClient`.
    // It is unused today; reserved for future shared infrastructure.
    _sdk: typeof AppStoreServerSdk.Service,
    config: SignedDataVerifierConfig,
  ): SignedDataVerifier => {
    const appAppleIdConfig = asOption(config.appAppleId);
    const verifyNotificationOverrideConfig = asOption(config.verifyNotificationOverride);

    const skipSignatureValidation =
      config.environment === Environment.XCODE || config.environment === Environment.LOCAL_TESTING;

    const verifyAndDecodeJws = <T>(
      signedData: string,
      schema: DecodableSchema<T>,
    ): Effect.Effect<T, VerificationError | CertificateError> =>
      Effect.gen(function* () {
        // Decode the protected header (for x5c) and the payload without
        // verifying the signature yet — mirrors the previous jwt.decode step.
        const header = yield* Effect.try({
          try: () => decodeProtectedHeader(signedData),
          catch: () => makeVerificationError(VerificationStatus.VERIFICATION_FAILURE),
        });

        const rawPayload = yield* Effect.try({
          try: () => decodeJwt(signedData),
          catch: () => makeVerificationError(VerificationStatus.VERIFICATION_FAILURE),
        });

        const payload = yield* Schema.decodeUnknownEffect(schema)(rawPayload).pipe(
          Effect.mapError(() => makeVerificationError(VerificationStatus.VERIFICATION_FAILURE)),
        );

        // In LocalTesting / Xcode we skip the certificate chain check and JWS
        // signature verification; the data isn't signed by Apple in those envs.
        if (skipSignatureValidation) {
          return payload;
        }

        const x5c = header.x5c;
        if (!x5c || !Array.isArray(x5c) || x5c.length !== 3) {
          return yield* Effect.fail(makeVerificationError(VerificationStatus.INVALID_CHAIN_LENGTH));
        }

        const certChain = yield* extractCertificateChain(x5c);

        const chainConfig: CertificateChainValidationConfig = {
          rootCertificates: config.rootCertificates,
          enableOnlineChecks: config.enableOnlineChecks,
          currentTime: Option.none(),
        };

        yield* validateCertificateChain(certChain, chainConfig);

        const publicKey = yield* getPublicKeyFromChain(certChain);

        // Verify the JWS signature against the leaf certificate's public key.
        // `jose` enforces the ES256 algorithm via the imported CryptoKey.
        yield* Effect.tryPromise({
          try: () => compactVerify(signedData, publicKey),
          catch: () => makeVerificationError(VerificationStatus.VERIFICATION_FAILURE),
        });

        return payload;
      });

    const checkBundle = (bundleId: Option.Option<string>): Effect.Effect<void, VerificationError> => {
      if (Option.isSome(bundleId) && bundleId.value !== config.bundleId) {
        return Effect.fail(makeVerificationError(VerificationStatus.INVALID_APP_IDENTIFIER));
      }
      return Effect.void;
    };

    const checkEnvironment = (
      environment: Option.Option<string>,
    ): Effect.Effect<void, VerificationError> => {
      if (Option.isSome(environment) && environment.value !== config.environment) {
        return Effect.fail(makeVerificationError(VerificationStatus.INVALID_ENVIRONMENT));
      }
      return Effect.void;
    };

    const validateTransactionPayload = (
      payload: JWSTransactionDecodedPayload,
    ): Effect.Effect<void, VerificationError> =>
      Effect.gen(function* () {
        yield* checkBundle(payload.bundleId);
        yield* checkEnvironment(payload.environment);
      });

    const validateRenewalPayload = (
      payload: JWSRenewalInfoDecodedPayload,
    ): Effect.Effect<void, VerificationError> => checkEnvironment(payload.environment);

    const validateAppTransactionPayload = (
      payload: AppTransaction,
    ): Effect.Effect<void, VerificationError> =>
      Effect.gen(function* () {
        yield* checkBundle(payload.bundleId);
        if (
          config.environment === Environment.PRODUCTION &&
          Option.isSome(appAppleIdConfig) &&
          Option.isSome(payload.appAppleId) &&
          payload.appAppleId.value !== appAppleIdConfig.value
        ) {
          return yield* Effect.fail(
            makeVerificationError(VerificationStatus.INVALID_APP_IDENTIFIER),
          );
        }
        yield* checkEnvironment(payload.receiptType);
      });

    const validateRealtimePayload = (
      payload: DecodedRealtimeRequestBody,
    ): Effect.Effect<void, VerificationError> =>
      Effect.gen(function* () {
        if (
          config.environment === Environment.PRODUCTION &&
          Option.isSome(appAppleIdConfig) &&
          payload.appAppleId !== appAppleIdConfig.value
        ) {
          return yield* Effect.fail(
            makeVerificationError(VerificationStatus.INVALID_APP_IDENTIFIER),
          );
        }
        yield* checkEnvironment(Option.some(payload.environment));
      });

    const runOverride = (
      bundleId: Option.Option<string>,
      appAppleId: Option.Option<number>,
      environment: Option.Option<string>,
    ): Effect.Effect<void, VerificationError> =>
      Effect.suspend(() => {
        if (Option.isNone(verifyNotificationOverrideConfig)) return Effect.void;
        const override = verifyNotificationOverrideConfig.value;
        return Effect.try({
          try: () => override(bundleId, appAppleId, environment),
          catch: (error) => {
            if (error instanceof VerificationError) return error;
            return makeVerificationError(VerificationStatus.INVALID_APP_IDENTIFIER);
          },
        }).pipe(
          Effect.flatMap((result) => {
            if (Effect.isEffect(result)) return result;
            return Effect.void;
          }),
        );
      });

    const validateNotificationPayload = (
      payload: ResponseBodyV2DecodedPayload,
    ): Effect.Effect<void, VerificationError> =>
      Effect.gen(function* () {
        let appAppleId = Option.none<number>();
        let bundleId = Option.none<string>();
        let environment = Option.none<string>();
        if (Option.isSome(payload.data)) {
          appAppleId = payload.data.value.appAppleId;
          bundleId = payload.data.value.bundleId;
          environment = payload.data.value.environment;
        } else if (Option.isSome(payload.summary)) {
          appAppleId = payload.summary.value.appAppleId;
          bundleId = payload.summary.value.bundleId;
          environment = payload.summary.value.environment;
        } else if (Option.isSome(payload.externalPurchaseToken)) {
          appAppleId = payload.externalPurchaseToken.value.appAppleId;
          bundleId = payload.externalPurchaseToken.value.bundleId;
          environment = Option.map(
            payload.externalPurchaseToken.value.externalPurchaseId,
            environmentFromExternalPurchaseId,
          );
        } else if (Option.isSome(payload.appData)) {
          appAppleId = payload.appData.value.appAppleId;
          bundleId = payload.appData.value.bundleId;
          environment = payload.appData.value.environment;
        }

        if (Option.isSome(verifyNotificationOverrideConfig)) {
          yield* runOverride(bundleId, appAppleId, environment);
          return;
        }

        if (Option.isNone(bundleId) || bundleId.value !== config.bundleId) {
          return yield* Effect.fail(
            makeVerificationError(VerificationStatus.INVALID_APP_IDENTIFIER),
          );
        }
        if (
          config.environment === Environment.PRODUCTION &&
          Option.isSome(appAppleIdConfig) &&
          (Option.isNone(appAppleId) || appAppleId.value !== appAppleIdConfig.value)
        ) {
          return yield* Effect.fail(
            makeVerificationError(VerificationStatus.INVALID_APP_IDENTIFIER),
          );
        }
        if (Option.isNone(environment) || environment.value !== config.environment) {
          return yield* Effect.fail(makeVerificationError(VerificationStatus.INVALID_ENVIRONMENT));
        }
      });

    return {
      verifyAndDecodeTransaction: (signedTransaction) =>
        Effect.gen(function* () {
          const payload = yield* verifyAndDecodeJws(
            signedTransaction,
            JWSTransactionDecodedPayloadSchema,
          );
          yield* validateTransactionPayload(payload);
          return payload;
        }),

      verifyAndDecodeRenewalInfo: (signedRenewalInfo) =>
        Effect.gen(function* () {
          const payload = yield* verifyAndDecodeJws(
            signedRenewalInfo,
            JWSRenewalInfoDecodedPayloadSchema,
          );
          yield* validateRenewalPayload(payload);
          return payload;
        }),

      verifyAndDecodeNotification: (signedPayload) =>
        Effect.gen(function* () {
          const payload = yield* verifyAndDecodeJws(
            signedPayload,
            ResponseBodyV2DecodedPayloadSchema,
          );
          yield* validateNotificationPayload(payload);
          return payload;
        }),

      verifyAndDecodeAppTransaction: (signedAppTransaction) =>
        Effect.gen(function* () {
          const payload = yield* verifyAndDecodeJws(signedAppTransaction, AppTransactionSchema);
          yield* validateAppTransactionPayload(payload);
          return payload;
        }),

      verifyAndDecodeRealtimeRequest: (signedPayload) =>
        Effect.gen(function* () {
          const payload = yield* verifyAndDecodeJws(
            signedPayload,
            DecodedRealtimeRequestBodySchema,
          );
          yield* validateRealtimePayload(payload);
          return payload;
        }),
    };
  },
};
