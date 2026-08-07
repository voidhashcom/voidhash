/**
 * Apple Push Notification service adapter — the `provider='apns'` delivery edge.
 * Config validation is fully built and NOT gated (APNs configs always save and
 * enable). The `deliver` engine — ES256 provider-auth JWT (cached per isolate) →
 * HTTP/2 `POST /3/device/{token}` → normalized classification — is fully built
 * too, but is held behind a **runtime `deliveryEnabled` gate**: sending to APNs
 * requires HTTP/2 + ALPN from a Worker, which can only be confirmed on a deployed
 * preview/prod smoke test (local `workerd` fails ALPN). While the gate is closed
 * (`APNS_DELIVERY_ENABLED` unset) `deliver` fails with the routable
 * `PushNotImplementedError` (recorded Failed/skipped, never silently dropped).
 * Flipping the env promotes it.
 *
 * `deliver` NEVER DEFECTS — the stored configuration is decrypted internally and
 * every failure (decrypt, JWT sign, network) is mapped onto the normalized
 * {@link PushDeliveryError} channel.
 */
import { Clock, Duration, Effect, Layer, Option, Schema } from "effect";
import { FetchHttpClient, Headers, HttpBody, HttpClient } from "effect/unstable/http";

import { constant, stringOr } from "@voidhash/lib/lang";

import { NotificationConfigValidationError } from "../../domain/notifications/PushNotificationConfiguration.ts";
import { PaymentConfigSecretCrypto } from "../../utils/crypto/PaymentConfigSecretCrypto.ts";
import { signJwtEs256 } from "../../utils/crypto/jwt-sign.ts";
import { isEncrypted } from "../../utils/crypto/SecretBox.ts";
import {
  ApplePushNotificationService,
  PushBadTokenError,
  PushInvalidCredentialsError,
  PushNotImplementedError,
  PushPayloadTooLargeError,
  PushRateExceededError,
  PushTransientError,
  PushUnregisteredError,
  type DeviceToken,
  type PushDeliveryError,
  type PushDeliveryProviderShape,
  type PushDeliverySuccess,
  type PushMessage,
} from "./push-delivery-provider.ts";

const APNS_TEAM_ID_PATTERN = /^[A-Z0-9]{10}$/;
const APNS_SEND_TIMEOUT = Duration.seconds(15);
/** APNs provider tokens are valid for up to 1h; refresh well inside that window. */
const APNS_TOKEN_TTL_SECONDS = 50 * 60;

/** The persisted APNs configuration shape (inside `push_notification_config.configuration`). */
export const apnsConfigurationSchema = Schema.Struct({
  /** Apple Team ID -> JWT `iss` claim. */
  teamId: Schema.String.check(Schema.isPattern(APNS_TEAM_ID_PATTERN)),
  /** Auth Key ID -> JWT `kid` header. */
  keyId: Schema.String.check(Schema.isMinLength(1)),
  /** PEM `.p8` ES256 signing key. SECRET — encrypted on write, omitted on read. */
  privateKeyContent: Schema.String.check(Schema.isMinLength(1)),
  /** `apns-topic` + token validation + `pushProviderKey`. */
  bundleId: Schema.String.check(Schema.isMinLength(1)),
  /** Selects the endpoint host. */
  environment: Schema.Literals(["sandbox", "production"]),
});

export type ApnsConfiguration = typeof apnsConfigurationSchema.Type;

const APNS_DEFAULT_CONFIGURATION = constant({
  teamId: "",
  keyId: "",
  privateKeyContent: "",
  bundleId: "",
  environment: "production",
}) satisfies Record<string, unknown>;

/**
 * APNs delivery runs on Cloudflare Workers, where the platform `fetch` is the
 * only transport. Discharging the `HttpClient` requirement locally (rather than
 * threading it through the provider factory) keeps `deliver` dependency-free, as
 * the erased {@link PushDeliveryProviderShape} contract requires.
 */
const withFetchClient = Effect.provide(FetchHttpClient.layer);

/** The `JSON.stringify` seam — the same Schema codec the FCM sender uses. */
const encodeJsonValue = Schema.encodeSync(Schema.UnknownFromJsonString);

const readString = (configuration: Record<string, unknown>, key: string): string =>
  stringOr(configuration[key], "");

/**
 * Build the APNs JSON payload — pure, unit-testable. Data fields are merged at
 * the top level alongside `aps` (APNs custom keys convention).
 */
export const buildApnsPayload = (message: PushMessage): Record<string, unknown> => {
  const aps: Record<string, unknown> = {
    alert: { title: message.title, body: message.body },
  };
  if (message.sound) {
    aps.sound = message.sound;
  }
  if (message.badge !== undefined) {
    aps.badge = message.badge;
  }
  return { aps, ...message.data };
};

const apnsErrorSchema = Schema.fromJsonString(
  Schema.Struct({ reason: Schema.optional(Schema.Unknown) }),
);

/**
 * Decode a JSON response body against `schema`, yielding `Option.none()` when the
 * body is absent, non-JSON or shaped unexpectedly — the parse must never defect.
 */
const decodeJsonBody = <S extends Schema.Codec<any, string>>(schema: S, bodyText: string) =>
  Effect.option(Schema.decodeUnknownEffect(schema)(bodyText));

/** Map an APNs failure `reason` (plus the HTTP status as fallback) onto the normalized vocabulary. */
const classifyApnsReason = (
  statusCode: number,
  reason: string,
): Effect.Effect<never, PushDeliveryError> => {
  switch (reason) {
    case "Unregistered":
      return Effect.fail(new PushUnregisteredError({ statusCode }));
    case "BadDeviceToken":
    case "DeviceTokenNotForTopic":
      return Effect.fail(new PushBadTokenError({ statusCode }));
    case "PayloadTooLarge":
      return Effect.fail(new PushPayloadTooLargeError({ statusCode }));
    case "TooManyRequests":
      return Effect.fail(new PushRateExceededError({ statusCode }));
    case "ExpiredProviderToken":
    case "InvalidProviderToken":
    case "MissingProviderToken":
      return Effect.fail(new PushInvalidCredentialsError({ statusCode }));
    default:
      break;
  }
  if (statusCode === 410) {
    return Effect.fail(new PushUnregisteredError({ statusCode }));
  }
  if (statusCode === 403) {
    return Effect.fail(new PushInvalidCredentialsError({ statusCode }));
  }
  if (statusCode === 413) {
    return Effect.fail(new PushPayloadTooLargeError({ statusCode }));
  }
  if (statusCode === 429) {
    return Effect.fail(new PushRateExceededError({ statusCode }));
  }
  if (statusCode >= 500) {
    return Effect.fail(new PushTransientError({ statusCode }));
  }
  return Effect.fail(new PushBadTokenError({ statusCode }));
};

/**
 * Classify an APNs response onto the normalized error vocabulary — pure. APNs
 * returns the failure `reason` in the JSON body; 410 (Unregistered) additionally
 * carries a `timestamp` used by the freshness gate upstream.
 */
export const classifyApnsResult = (
  statusCode: number,
  bodyText: string,
  apnsId?: string,
): Effect.Effect<PushDeliverySuccess, PushDeliveryError> =>
  Effect.gen(function* () {
    if (statusCode >= 200 && statusCode < 300) {
      return { statusCode, providerMessageId: apnsId };
    }
    const parsed = Option.getOrUndefined(yield* decodeJsonBody(apnsErrorSchema, bodyText));
    return yield* classifyApnsReason(statusCode, stringOr(parsed?.reason, ""));
  });

/** Sandbox and production are separate APNs hosts; the token environment selects one. */
const apnsHost = (environment: string): string => {
  if (environment === "sandbox") return "api.sandbox.push.apple.com";
  return "api.push.apple.com";
};

/** `apns-priority`: 10 delivers immediately, 5 is the power-considerate default. */
const apnsPriority = (priority: PushMessage["priority"]): string => {
  if (priority === "high") return "10";
  return "5";
};

/**
 * POST the payload to APNs. A network error or the send timeout becomes a
 * RETRYABLE typed error, never a defect that escapes the `deliver` channel; the
 * response itself is classified by the caller.
 */
const sendOnce = (
  host: string,
  platformToken: string,
  apnsHeaders: Record<string, string>,
  message: PushMessage,
): Effect.Effect<
  { readonly status: number; readonly bodyText: string; readonly apnsId?: string },
  PushDeliveryError
> =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    const response = yield* client.post(`https://${host}/3/device/${platformToken}`, {
      headers: apnsHeaders,
      body: HttpBody.text(encodeJsonValue(buildApnsPayload(message)), "application/json"),
    });
    const bodyText = yield* response.text.pipe(Effect.orElseSucceed(() => ""));
    return {
      status: response.status,
      bodyText,
      apnsId: Option.getOrUndefined(Headers.get(response.headers, "apns-id")),
    };
  }).pipe(
    Effect.timeout(APNS_SEND_TIMEOUT),
    Effect.mapError(() => new PushTransientError({})),
    withFetchClient,
  );

interface CachedProviderToken {
  readonly token: string;
  readonly issuedAtEpochMs: number;
}

/**
 * Builds the erased {@link PushDeliveryProviderShape} for APNs, closing over the
 * shared secret crypto seam, a per-isolate provider-token cache, and the
 * runtime delivery gate. When `deliveryEnabled` is false, `deliver` short-circuits
 * to the `NotImplemented` sentinel — the real HTTP/2 path stays dormant until a
 * deployed smoke test verifies ALPN from a Worker.
 */
export const makeApplePushNotificationProvider = (
  secretCrypto: typeof PaymentConfigSecretCrypto.Service,
  deliveryEnabled: boolean,
): PushDeliveryProviderShape<"apns"> => {
  // Provider-auth token cache keyed by `${teamId}:${keyId}` (a single Apple
  // token authenticates ALL topics for that key). A shared cross-isolate cache
  // is a Phase-3 concern; per-isolate is sufficient here.
  const tokenCache = new Map<string, CachedProviderToken>();

  const getProviderToken = (
    teamId: string,
    keyId: string,
    privateKeyPem: string,
  ): Effect.Effect<string, PushDeliveryError> =>
    Effect.gen(function* () {
      const cacheKey = `${teamId}:${keyId}`;
      const cached = tokenCache.get(cacheKey);
      const nowMillis = yield* Clock.currentTimeMillis;
      if (cached && nowMillis - cached.issuedAtEpochMs < APNS_TOKEN_TTL_SECONDS * 1000) {
        return cached.token;
      }
      const nowSeconds = Math.floor(nowMillis / 1000);
      const token = yield* signJwtEs256(
        keyId,
        { iss: teamId, iat: nowSeconds },
        privateKeyPem,
      ).pipe(Effect.mapError(() => new PushInvalidCredentialsError({})));
      const issuedAtEpochMs = yield* Clock.currentTimeMillis;
      tokenCache.set(cacheKey, { token, issuedAtEpochMs });
      return token;
    });

  const deliver = (
    configuration: Record<string, unknown>,
    token: DeviceToken,
    message: PushMessage,
  ): Effect.Effect<PushDeliverySuccess, PushDeliveryError> => {
    if (!deliveryEnabled) {
      // Gate closed: fail with the routable `PushNotImplementedError` so the
      // delivery row records Failed (not Succeeded) rather than being dropped.
      return Effect.fail(new PushNotImplementedError({}));
    }
    return Effect.gen(function* () {
      const teamId = readString(configuration, "teamId");
      const keyId = readString(configuration, "keyId");
      const bundleId = token.bundleId ?? readString(configuration, "bundleId");
      const environment =
        token.environment ?? (readString(configuration, "environment") || "production");
      const privateKeyPem = yield* secretCrypto
        .decrypt(readString(configuration, "privateKeyContent"))
        .pipe(Effect.mapError(() => new PushInvalidCredentialsError({})));

      const providerToken = yield* getProviderToken(teamId, keyId, privateKeyPem);
      const host = apnsHost(environment);
      const apnsHeaders: Record<string, string> = {
        authorization: `bearer ${providerToken}`,
        "apns-topic": bundleId,
        "apns-push-type": "alert",
        "apns-priority": apnsPriority(message.priority),
      };
      if (message.collapseId) {
        apnsHeaders["apns-collapse-id"] = message.collapseId;
      }
      if (message.ttl !== undefined) {
        const nowMillis = yield* Clock.currentTimeMillis;
        apnsHeaders["apns-expiration"] = String(Math.floor(nowMillis / 1000) + message.ttl);
      }

      const raw = yield* sendOnce(host, token.platformToken, apnsHeaders, message);
      return yield* classifyApnsResult(raw.status, raw.bodyText, raw.apnsId);
    });
  };

  return {
    id: "apns",
    title: "Apple Push Notification service",
    defaultGlobalConfiguration: () => Effect.succeed({ ...APNS_DEFAULT_CONFIGURATION }),
    validateGlobalConfiguration: (configuration) =>
      Schema.decodeUnknownEffect(apnsConfigurationSchema)(configuration).pipe(
        Effect.mapError((error) => new NotificationConfigValidationError({ cause: error.message })),
        Effect.flatMap((parsed) =>
          // Encrypt the .p8 private key before persist (idempotent). A
          // `SecretKeyError` is a deploy misconfiguration — fail as a defect.
          secretCrypto.encrypt(parsed.privateKeyContent).pipe(
            Effect.map((privateKeyContent) => ({
              parsedConfiguration: { ...parsed, privateKeyContent },
              pushProviderKey: parsed.bundleId,
            })),
            Effect.orDie,
          ),
        ),
      ),
    toReadDto: (configuration) => ({
      teamId: readString(configuration, "teamId"),
      keyId: readString(configuration, "keyId"),
      bundleId: readString(configuration, "bundleId"),
      environment: configuration.environment ?? "production",
      hasPrivateKey: readString(configuration, "privateKeyContent").length > 0,
    }),
    hasPlaintextSecret: (configuration) => {
      const secret = readString(configuration, "privateKeyContent");
      return secret.length > 0 && !isEncrypted(secret);
    },
    deliver,
  };
};

/**
 * The Live layer (requires {@link PaymentConfigSecretCrypto}). `deliveryEnabled`
 * is resolved at layer build from the injected effect (the app root reads
 * `APNS_DELIVERY_ENABLED`); default OFF keeps the HTTP/2 gate closed.
 */
export const makeApplePushNotificationServiceConfigLive = (config: {
  readonly deliveryEnabled: Effect.Effect<boolean>;
}): Layer.Layer<ApplePushNotificationService, never, PaymentConfigSecretCrypto> =>
  Layer.effect(ApplePushNotificationService)(
    Effect.gen(function* () {
      const secretCrypto = yield* PaymentConfigSecretCrypto;
      const deliveryEnabled = yield* config.deliveryEnabled;
      return makeApplePushNotificationProvider(secretCrypto, deliveryEnabled);
    }),
  );

/** Back-compat Live layer with the delivery gate CLOSED (config-write only). */
export const ApplePushNotificationServiceConfigLive: Layer.Layer<
  ApplePushNotificationService,
  never,
  PaymentConfigSecretCrypto
> = makeApplePushNotificationServiceConfigLive({ deliveryEnabled: Effect.succeed(false) });
