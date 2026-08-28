/**
 * Per-tenant App Store SDK helpers shared by the webhook handler and the SDK
 * boundary. Owns construction of the REST client and signed-data verifier and
 * encapsulates the production-then-sandbox fallback strategy — Apple does not
 * tell us which environment a transaction or notification originated from, so
 * we try production first and fall back on the corresponding "not found" /
 * verification failure tag.
 */
import {
  type AppStoreServerSdk,
  type AppStoreServerSdkClient as AppStoreServerSdkClientService,
  AppStoreServerSdkClient,
  Environment,
  SignedDataVerifier,
  type SignedDataVerifier as SignedDataVerifierService,
  type TransactionHistoryRequest,
  type GetTransactionHistoryVersion,
  type Status,
} from "@voidhash/app-store-server-sdk";
import { Effect, Option } from "effect";

import { APPLE_ROOT_CERTIFICATES_PEM } from "./constants.ts";

export type AppStoreEnvironment = (typeof Environment)[keyof typeof Environment];

export type AppStoreSignedDataVerifierFactory = (
  environment: AppStoreEnvironment,
) => Pick<
  SignedDataVerifierService,
  "verifyAndDecodeNotification" | "verifyAndDecodeRenewalInfo" | "verifyAndDecodeTransaction"
>;

/** Minimal App Store Server API surface used by purchase processing. */
export type AppStoreServerApiClient = Pick<
  AppStoreServerSdkClientService,
  "getAllSubscriptionStatuses" | "getTransactionHistory" | "getTransactionInfo"
>;

/** Inputs exposed to an optional runtime-specific App Store API client factory. */
export type AppStoreServerApiClientFactoryInput = {
  readonly appAppleId: string;
  readonly bundleId: string;
  readonly environment: AppStoreEnvironment;
  readonly inAppPurchaseKeyIssuerId: string;
  readonly inAppPurchaseKeyId: string;
  readonly inAppPurchasePrivateKey: string;
};

/** Supplies an App Store API client for a requested environment when overridden. */
export type AppStoreServerApiClientFactory = (
  input: AppStoreServerApiClientFactoryInput,
) => AppStoreServerApiClient | undefined;

export type AppStoreSdkContextConfig = {
  readonly appAppleId: string;
  readonly bundleId: string;
  readonly inAppPurchaseKeyIssuerId: string;
  readonly inAppPurchaseKeyId: string;
  readonly inAppPurchasePrivateKey: string;
  /** Overrides only signed-data verification while leaving REST routing unchanged. */
  readonly verifierEnvironmentOverride?: AppStoreEnvironment;
  /** Supplies the signed-data verifier used for a requested Apple environment. */
  readonly verifierFactory?: AppStoreSignedDataVerifierFactory;
  /** Supplies the App Store API client used for a requested Apple environment. */
  readonly apiClientFactory?: AppStoreServerApiClientFactory;
};

export const buildAppStoreSdkContext = (
  appStoreServerSdk: typeof AppStoreServerSdk.Service,
  config: AppStoreSdkContextConfig,
) => {
  const clientFor = (environment: AppStoreEnvironment) =>
    config.apiClientFactory?.({
      appAppleId: config.appAppleId,
      bundleId: config.bundleId,
      environment,
      inAppPurchaseKeyId: config.inAppPurchaseKeyId,
      inAppPurchaseKeyIssuerId: config.inAppPurchaseKeyIssuerId,
      inAppPurchasePrivateKey: config.inAppPurchasePrivateKey,
    }) ??
    AppStoreServerSdkClient.make(appStoreServerSdk, {
      bundleId: config.bundleId,
      environment,
      issuerId: config.inAppPurchaseKeyIssuerId,
      keyId: config.inAppPurchaseKeyId,
      signingKey: config.inAppPurchasePrivateKey,
    });

  const verifierFor = (environment: AppStoreEnvironment) =>
    config.verifierFactory?.(environment) ??
    SignedDataVerifier.make(appStoreServerSdk, {
      appAppleId: Option.some(Number(config.appAppleId)),
      bundleId: config.bundleId,
      enableOnlineChecks: true,
      environment: config.verifierEnvironmentOverride ?? environment,
      rootCertificates: [...APPLE_ROOT_CERTIFICATES_PEM],
      verifyNotificationOverride: Option.fromNullishOr(config.verifierEnvironmentOverride).pipe(
        Option.match({
          onNone: () => Option.none(),
          onSome: () => Option.some(() => undefined),
        }),
      ),
    });

  const getTransactionInfo = (transactionId: string) => {
    const tryEnvironment = (environment: AppStoreEnvironment) =>
      clientFor(environment)
        .getTransactionInfo(transactionId)
        .pipe(Effect.map((transactionInfo) => ({ environment, transactionInfo })));

    return tryEnvironment(Environment.PRODUCTION).pipe(
      Effect.catchTag("AppStoreNotFoundError", () => tryEnvironment(Environment.SANDBOX)),
    );
  };

  const decodeSignedTransaction = (
    signedTransactionInfo: string,
    environment: AppStoreEnvironment,
  ) => verifierFor(environment).verifyAndDecodeTransaction(signedTransactionInfo);

  /**
   * Decodes Apple's signed renewal info JWS using the per-tenant verifier.
   * Mirrors {@link decodeSignedTransaction}; both webhook and reconciliation
   * paths use this to extract `gracePeriodExpiresDate`, `autoRenewStatus`,
   * `priceIncreaseStatus`, and renewal pricing fields that live on
   * `renewalInfo` rather than the transaction itself.
   */
  const decodeSignedRenewalInfo = (signedRenewalInfo: string, environment: AppStoreEnvironment) =>
    verifierFor(environment).verifyAndDecodeRenewalInfo(signedRenewalInfo);

  const decodeNotification = (signedPayload: string) => {
    const tryEnvironment = (environment: AppStoreEnvironment) =>
      verifierFor(environment).verifyAndDecodeNotification(signedPayload);

    return tryEnvironment(Environment.PRODUCTION).pipe(
      Effect.catchTag("VerificationError", () => tryEnvironment(Environment.SANDBOX)),
    );
  };

  /**
   * Production-then-sandbox fallback wrapper around `getTransactionHistory`.
   * Mirrors {@link getTransactionInfo}'s strategy — Apple doesn't tell us
   * which environment the original transaction lives in, so we try production
   * first and fall back on `AppStoreNotFoundError`.
   *
   * Returns the matched environment alongside the response so callers can
   * use the right verifier when decoding signed transactions from the
   * history.
   */
  const getTransactionHistoryWithEnvironmentFallback = (
    transactionId: string,
    revision: Option.Option<string>,
    request: TransactionHistoryRequest,
    version: Option.Option<
      (typeof GetTransactionHistoryVersion)[keyof typeof GetTransactionHistoryVersion]
    >,
  ) => {
    const tryEnvironment = (environment: AppStoreEnvironment) =>
      clientFor(environment)
        .getTransactionHistory(transactionId, revision, request, version)
        .pipe(Effect.map((historyResponse) => ({ environment, historyResponse })));

    return tryEnvironment(Environment.PRODUCTION).pipe(
      Effect.catchTag("AppStoreNotFoundError", () => tryEnvironment(Environment.SANDBOX)),
    );
  };

  /**
   * Production-then-sandbox fallback wrapper around `getAllSubscriptionStatuses`.
   * Same fallback semantics as the history wrapper above.
   */
  const getAllSubscriptionStatusesWithEnvironmentFallback = (
    transactionId: string,
    status: Option.Option<Status[]>,
  ) => {
    const tryEnvironment = (environment: AppStoreEnvironment) =>
      clientFor(environment)
        .getAllSubscriptionStatuses(transactionId, status)
        .pipe(Effect.map((statusResponse) => ({ environment, statusResponse })));

    return tryEnvironment(Environment.PRODUCTION).pipe(
      Effect.catchTag("AppStoreNotFoundError", () => tryEnvironment(Environment.SANDBOX)),
    );
  };

  return {
    bundleId: config.bundleId,
    decodeNotification,
    decodeSignedRenewalInfo,
    decodeSignedTransaction,
    getAllSubscriptionStatusesWithEnvironmentFallback,
    getTransactionHistoryWithEnvironmentFallback,
    getTransactionInfo,
  };
};

export type AppStoreSdkContext = ReturnType<typeof buildAppStoreSdkContext>;
