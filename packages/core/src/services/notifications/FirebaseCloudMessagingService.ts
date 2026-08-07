/**
 * Firebase Cloud Messaging adapter — the `provider='fcm'` delivery edge and the
 * primary push transport. Ships the full config-write slice
 * (`defaultGlobalConfiguration`, `validateGlobalConfiguration` with
 * **encrypt-on-write** of the service-account JSON, secret-omitting `toReadDto`,
 * and the fail-closed `hasPlaintextSecret` gate helper) AND the live `deliver`
 * engine: RS256 service-account JWT → OAuth2 access token (cached per isolate) →
 * `POST /v1/projects/{id}/messages:send`, with the response classified onto the
 * normalized {@link PushDeliveryError} tagged-error channel.
 *
 * FCM addresses devices by FCM registration token ONLY (Android, and iOS that
 * integrates the Firebase iOS SDK, via the `apns` override). It cannot address a
 * raw APNs hex token — those route through {@link ApplePushNotificationService}.
 *
 * `deliver` NEVER defects: the stored configuration is handed in verbatim (secret
 * still encrypted) and decrypted internally, so every failure — decrypt, JWT
 * sign, OAuth, network — is mapped onto the normalized {@link PushDeliveryError}
 * channel rather than thrown.
 */
import { constant, numberOr, stringOr } from "@voidhash/lib/lang";
import { Clock, Duration, Effect, Layer, Option, Schema } from "effect";
import { FetchHttpClient, Headers, HttpBody, HttpClient } from "effect/unstable/http";

import { NotificationConfigValidationError } from "../../domain/notifications/PushNotificationConfiguration.ts";
import { PaymentConfigSecretCrypto } from "../../utils/crypto/PaymentConfigSecretCrypto.ts";
import { signJwtRs256 } from "../../utils/crypto/jwt-sign.ts";
import { isEncrypted } from "../../utils/crypto/SecretBox.ts";
import {
  FirebaseCloudMessagingService,
  PushBadTokenError,
  PushInvalidCredentialsError,
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

/** The persisted FCM configuration shape (inside `push_notification_config.configuration`). */
export const fcmConfigurationSchema = Schema.Struct({
  /** FCM project id — the `{project_id}` path segment; becomes `pushProviderKey`. */
  projectId: Schema.String.check(Schema.isMinLength(1)),
  /**
   * The service-account JSON (`client_email` + `private_key` + `token_uri` +
   * `project_id`) serialized as a string. SECRET — encrypted on write, omitted
   * on read. MUST be a dedicated minimal-scope account (FCM API only).
   */
  serviceAccountJson: Schema.String.check(Schema.isMinLength(1)),
  androidPriority: Schema.optional(Schema.Literals(["high", "normal"])),
  androidTtl: Schema.optional(Schema.String),
  apnsPriority: Schema.optional(Schema.Literals(["5", "10"])),
});

export type FcmConfiguration = typeof fcmConfigurationSchema.Type;

const FCM_DEFAULT_CONFIGURATION = constant({
  projectId: "",
  serviceAccountJson: "",
  androidPriority: "normal",
  androidTtl: "2419200s", // 28d, the FCM max
  apnsPriority: "10",
}) satisfies Record<string, unknown>;

const FCM_OAUTH_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const FCM_DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token";
const FCM_SEND_TIMEOUT = Duration.seconds(15);
/** Refresh a cached OAuth token this many seconds before its stated expiry. */
const FCM_TOKEN_REFRESH_SKEW_SECONDS = 60;

/**
 * FCM delivery runs on Cloudflare Workers, where the platform `fetch` is the
 * only transport. Discharging the `HttpClient` requirement locally (rather than
 * threading it through the provider factory) keeps `deliver` dependency-free, as
 * the erased {@link PushDeliveryProviderShape} contract requires.
 */
const withFetchClient = Effect.provide(FetchHttpClient.layer);

/** The `JSON.stringify` seam — the same Schema codec the webhook sender uses. */
const encodeJsonValue = Schema.encodeSync(Schema.UnknownFromJsonString);

const readString = (configuration: Record<string, unknown>, key: string): string =>
  stringOr(configuration[key], "");

const stringOrUndefined = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    return value;
  }
  return undefined;
};

/**
 * Decode a JSON response body against `schema`, yielding `Option.none()` when the
 * body is absent, non-JSON or shaped unexpectedly — the parse must never defect.
 */
const decodeJsonBody = <S extends Schema.Codec<any, string>>(schema: S, bodyText: string) =>
  Effect.option(Schema.decodeUnknownEffect(schema)(bodyText));

/** Parsed service-account credentials extracted from the config secret JSON. */
interface ServiceAccount {
  readonly clientEmail: string;
  readonly privateKey: string;
  readonly tokenUri: string;
}

const serviceAccountSchema = Schema.fromJsonString(
  Schema.Struct({
    client_email: Schema.optional(Schema.Unknown),
    private_key: Schema.optional(Schema.Unknown),
    token_uri: Schema.optional(Schema.Unknown),
  }),
);

const parseServiceAccount = (
  json: string,
): Effect.Effect<ServiceAccount, PushInvalidCredentialsError> =>
  Effect.gen(function* () {
    const parsed = Option.getOrUndefined(yield* decodeJsonBody(serviceAccountSchema, json));
    const clientEmail = stringOr(parsed?.client_email, "");
    const privateKey = stringOr(parsed?.private_key, "");
    if (clientEmail.length === 0 || privateKey.length === 0) {
      return yield* new PushInvalidCredentialsError({});
    }
    return {
      clientEmail,
      privateKey,
      tokenUri: stringOr(parsed?.token_uri, FCM_DEFAULT_TOKEN_URI),
    };
  });

/** FCM rejects non-string `data` values, so anything else is JSON-encoded. */
const toDataValue = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }
  return encodeJsonValue(value);
};

const buildDataBlock = (
  data: PushMessage["data"],
): Record<string, string> | undefined => {
  if (data === undefined) {
    return undefined;
  }
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, toDataValue(value)]));
};

const toAndroidPriority = (priority: PushMessage["priority"]): string => {
  if (priority === "high") {
    return "HIGH";
  }
  return "NORMAL";
};

/**
 * FCM v1 message body builder — pure, so it is unit-testable in isolation. Maps
 * the unified {@link PushMessage} to the platform-specific overrides FCM expects:
 * `data` values are coerced to strings (FCM rejects non-string data), and both
 * the `android` and `apns` blocks carry the priority/ttl/collapse hints.
 */
export const buildFcmMessage = (
  fcmToken: string,
  message: PushMessage,
  options: { readonly androidTtl?: string; readonly apnsPriority?: string },
): Record<string, unknown> => {
  const data = buildDataBlock(message.data);

  const android: Record<string, unknown> = {
    priority: toAndroidPriority(message.priority),
  };
  if (options.androidTtl) {
    android.ttl = options.androidTtl;
  }
  if (message.collapseId) {
    android.collapse_key = message.collapseId;
  }
  if (message.channelId || message.sound) {
    const notification: Record<string, unknown> = {};
    if (message.channelId) {
      notification.channel_id = message.channelId;
    }
    if (message.sound) {
      notification.sound = message.sound;
    }
    android.notification = notification;
  }

  const apnsHeaders: Record<string, string> = {
    "apns-priority": options.apnsPriority ?? "10",
  };
  if (message.collapseId) {
    apnsHeaders["apns-collapse-id"] = message.collapseId;
  }
  const aps: Record<string, unknown> = {
    alert: { title: message.title, body: message.body },
  };
  if (message.sound) {
    aps.sound = message.sound;
  }
  if (message.badge !== undefined) {
    aps.badge = message.badge;
  }

  const fcmMessage: Record<string, unknown> = {
    token: fcmToken,
    notification: { title: message.title, body: message.body },
  };
  if (data) {
    fcmMessage.data = data;
  }
  fcmMessage.android = android;
  fcmMessage.apns = { headers: apnsHeaders, payload: { aps } };

  return { message: fcmMessage };
};

const sendSuccessSchema = Schema.fromJsonString(
  Schema.Struct({ name: Schema.optional(Schema.Unknown) }),
);

const sendErrorSchema = Schema.fromJsonString(
  Schema.Struct({
    error: Schema.optional(
      Schema.Struct({
        status: Schema.optional(Schema.Unknown),
        details: Schema.optional(
          Schema.Array(Schema.Struct({ errorCode: Schema.optional(Schema.Unknown) })),
        ),
      }),
    ),
  }),
);

/**
 * Map an FCM canonical error code (plus the HTTP status as fallback) onto the
 * normalized vocabulary. Unforgiving mapping (see the enum docs), so it stays
 * explicit and conservative: unknown 4xx is terminal `BadToken`, unknown 5xx is
 * retryable `Transient`.
 */
const classifyFcmErrorCode = (
  statusCode: number,
  errorCode: string,
  retryAfterSeconds?: number,
): Effect.Effect<never, PushDeliveryError> => {
  switch (errorCode) {
    case "UNREGISTERED":
      return Effect.fail(new PushUnregisteredError({ statusCode }));
    case "INVALID_ARGUMENT":
    case "SENDER_ID_MISMATCH":
      return Effect.fail(new PushBadTokenError({ statusCode }));
    case "QUOTA_EXCEEDED":
      return Effect.fail(new PushRateExceededError({ statusCode, retryAfterSeconds }));
    case "THIRD_PARTY_AUTH_ERROR":
      return Effect.fail(new PushInvalidCredentialsError({ statusCode }));
    case "UNAVAILABLE":
    case "INTERNAL":
      return Effect.fail(new PushTransientError({ statusCode, retryAfterSeconds }));
    default:
      break;
  }
  if (statusCode === 401 || statusCode === 403) {
    return Effect.fail(new PushInvalidCredentialsError({ statusCode }));
  }
  if (statusCode === 404) {
    return Effect.fail(new PushUnregisteredError({ statusCode }));
  }
  if (statusCode === 400) {
    return Effect.fail(new PushBadTokenError({ statusCode }));
  }
  if (statusCode === 413) {
    return Effect.fail(new PushPayloadTooLargeError({ statusCode }));
  }
  if (statusCode === 429) {
    return Effect.fail(new PushRateExceededError({ statusCode, retryAfterSeconds }));
  }
  if (statusCode >= 500) {
    return Effect.fail(new PushTransientError({ statusCode, retryAfterSeconds }));
  }
  return Effect.fail(new PushBadTokenError({ statusCode }));
};

/**
 * Classify an FCM `messages:send` HTTP response onto the normalized error
 * vocabulary — pure so the (terminal vs retryable) decision is directly tested.
 * FCM v1 carries the canonical error in `error.details[].errorCode`, falling back
 * to `error.status`.
 */
export const classifyFcmResult = (
  statusCode: number,
  bodyText: string,
  retryAfterSeconds?: number,
): Effect.Effect<PushDeliverySuccess, PushDeliveryError> =>
  Effect.gen(function* () {
    if (statusCode >= 200 && statusCode < 300) {
      const parsed = Option.getOrUndefined(yield* decodeJsonBody(sendSuccessSchema, bodyText));
      return { statusCode, providerMessageId: stringOrUndefined(parsed?.name) };
    }

    const parsed = Option.getOrUndefined(yield* decodeJsonBody(sendErrorSchema, bodyText));
    const detailCode = parsed?.error?.details?.find(
      (detail) => typeof detail?.errorCode === "string",
    )?.errorCode;
    const errorCode = stringOr(detailCode, stringOr(parsed?.error?.status, ""));

    return yield* classifyFcmErrorCode(statusCode, errorCode, retryAfterSeconds);
  });

const parseRetryAfterSeconds = (headerValue: string | undefined): number | undefined => {
  if (!headerValue) {
    return undefined;
  }
  const asSeconds = Number(headerValue);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return asSeconds;
  }
  return undefined;
};

interface CachedAccessToken {
  readonly token: string;
  readonly expiresAtEpochMs: number;
}

const accessTokenSchema = Schema.fromJsonString(
  Schema.Struct({
    access_token: Schema.optional(Schema.Unknown),
    expires_in: Schema.optional(Schema.Unknown),
  }),
);

/**
 * Builds the erased {@link PushDeliveryProviderShape} for FCM, closing over the
 * shared secret crypto seam and a per-isolate OAuth token cache. Returning the
 * erased shape (rather than the typed `PushDeliveryProvider`) keeps it directly
 * assignable to the {@link FirebaseCloudMessagingService} tag.
 */
export const makeFirebaseCloudMessagingProvider = (
  secretCrypto: typeof PaymentConfigSecretCrypto.Service,
): PushDeliveryProviderShape<"fcm"> => {
  // Per-isolate OAuth access-token cache keyed by service-account email. Bounded
  // by the (tiny) number of distinct FCM configs an isolate serves; a shared
  // KV/DO cache is a Phase-3 concern. Concurrent refreshes are harmless (last
  // write wins), so no lock is taken.
  const tokenCache = new Map<string, CachedAccessToken>();

  const fetchAccessToken = (account: ServiceAccount): Effect.Effect<string, PushDeliveryError> =>
    Effect.gen(function* () {
      const nowMillis = yield* Clock.currentTimeMillis;
      const nowSeconds = Math.floor(nowMillis / 1000);
      const jwt = yield* signJwtRs256(
        {
          iss: account.clientEmail,
          scope: FCM_OAUTH_SCOPE,
          aud: account.tokenUri,
          iat: nowSeconds,
          exp: nowSeconds + 3600,
        },
        account.privateKey,
      ).pipe(Effect.mapError(() => new PushInvalidCredentialsError({})));

      const client = yield* HttpClient.HttpClient;
      // A network error is RETRYABLE; the response status decides the rest.
      const response = yield* client
        .post(account.tokenUri, {
          body: HttpBody.urlParams({
            grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
            assertion: jwt,
          }),
        })
        .pipe(Effect.mapError(() => new PushTransientError({})));
      const bodyText = yield* response.text.pipe(Effect.orElseSucceed(() => ""));
      if (response.status < 200 || response.status >= 300) {
        // 4xx from the token endpoint means the credentials are bad (terminal
        // config); 5xx is a transient Google outage.
        if (response.status >= 500) {
          return yield* new PushTransientError({ statusCode: response.status });
        }
        return yield* new PushInvalidCredentialsError({ statusCode: response.status });
      }
      // Guard the parse: a non-JSON token response must NOT throw a defect (the
      // consumer recovers typed errors from `deliver`, never defects).
      const parsed = Option.getOrUndefined(yield* decodeJsonBody(accessTokenSchema, bodyText));
      const accessToken = stringOr(parsed?.access_token, "");
      if (accessToken.length === 0) {
        return yield* new PushInvalidCredentialsError({});
      }
      const expiresIn = numberOr(parsed?.expires_in, 3600);
      const issuedAtMillis = yield* Clock.currentTimeMillis;
      tokenCache.set(account.clientEmail, {
        token: accessToken,
        expiresAtEpochMs: issuedAtMillis + expiresIn * 1000,
      });
      return accessToken;
    }).pipe(withFetchClient);

  const getAccessToken = (
    account: ServiceAccount,
    forceRefresh: boolean,
  ): Effect.Effect<string, PushDeliveryError> =>
    Effect.gen(function* () {
      if (forceRefresh) {
        tokenCache.delete(account.clientEmail);
        return yield* fetchAccessToken(account);
      }
      const cached = tokenCache.get(account.clientEmail);
      const nowMillis = yield* Clock.currentTimeMillis;
      if (cached && cached.expiresAtEpochMs - FCM_TOKEN_REFRESH_SKEW_SECONDS * 1000 > nowMillis) {
        return cached.token;
      }
      return yield* fetchAccessToken(account);
    });

  const sendOnce = (
    projectId: string,
    accessToken: string,
    body: Record<string, unknown>,
  ): Effect.Effect<
    { readonly status: number; readonly bodyText: string; readonly retryAfter?: number },
    PushDeliveryError
  > =>
    Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      const response = yield* client.post(
        `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          body: HttpBody.text(encodeJsonValue(body), "application/json"),
        },
      );
      const bodyText = yield* response.text.pipe(Effect.orElseSucceed(() => ""));
      return {
        status: response.status,
        bodyText,
        retryAfter: parseRetryAfterSeconds(
          Option.getOrUndefined(Headers.get(response.headers, "Retry-After")),
        ),
      };
    }).pipe(
      // A network error or the send timeout becomes a RETRYABLE typed error,
      // never a defect that escapes the `deliver` error channel.
      Effect.timeout(FCM_SEND_TIMEOUT),
      Effect.mapError(() => new PushTransientError({})),
      withFetchClient,
    );

  const deliver = (
    configuration: Record<string, unknown>,
    token: DeviceToken,
    message: PushMessage,
  ): Effect.Effect<PushDeliverySuccess, PushDeliveryError> =>
    Effect.gen(function* () {
      const projectId = readString(configuration, "projectId");
      const secretJson = yield* secretCrypto
        .decrypt(readString(configuration, "serviceAccountJson"))
        .pipe(Effect.mapError(() => new PushInvalidCredentialsError({})));
      const account = yield* parseServiceAccount(secretJson);

      const body = buildFcmMessage(token.platformToken, message, {
        androidTtl: readString(configuration, "androidTtl") || undefined,
        apnsPriority: readString(configuration, "apnsPriority") || undefined,
      });

      let accessToken = yield* getAccessToken(account, false);
      let response = yield* sendOnce(projectId, accessToken, body);
      // FCM 401 = the OAuth token expired mid-flight; refresh once WITHOUT
      // consuming a delivery attempt, then re-send.
      if (response.status === 401) {
        accessToken = yield* getAccessToken(account, true);
        response = yield* sendOnce(projectId, accessToken, body);
      }
      // Every internal failure above already fails with a normalized
      // `PushDeliveryError`, so no defect-catching wrapper is needed — the error
      // channel IS the classification.
      return yield* classifyFcmResult(response.status, response.bodyText, response.retryAfter);
    });

  return {
    id: "fcm",
    title: "Firebase Cloud Messaging",
    defaultGlobalConfiguration: () => Effect.succeed({ ...FCM_DEFAULT_CONFIGURATION }),
    validateGlobalConfiguration: (configuration) =>
      Schema.decodeUnknownEffect(fcmConfigurationSchema)(configuration).pipe(
        Effect.mapError((error) => new NotificationConfigValidationError({ cause: error.message })),
        Effect.flatMap((parsed) =>
          // Encrypt the service-account JSON before persist (idempotent — an
          // already-encrypted value passes through). A `SecretKeyError` here is a
          // deploy misconfiguration, not a validation error — fail as a defect.
          secretCrypto.encrypt(parsed.serviceAccountJson).pipe(
            Effect.map((serviceAccountJson) => ({
              parsedConfiguration: { ...parsed, serviceAccountJson },
              pushProviderKey: parsed.projectId,
            })),
            Effect.orDie,
          ),
        ),
      ),
    toReadDto: (configuration) => ({
      projectId: readString(configuration, "projectId"),
      androidPriority: configuration.androidPriority ?? "normal",
      androidTtl: configuration.androidTtl ?? "2419200s",
      apnsPriority: configuration.apnsPriority ?? "10",
      hasServiceAccountJson: readString(configuration, "serviceAccountJson").length > 0,
    }),
    hasPlaintextSecret: (configuration) => {
      const secret = readString(configuration, "serviceAccountJson");
      return secret.length > 0 && !isEncrypted(secret);
    },
    deliver,
  };
};

/**
 * The Live layer (requires {@link PaymentConfigSecretCrypto}). The app root
 * supplies crypto keyed by `ENCRYPTION_KEY`, exactly like
 * `AppStorePaymentProviderConfigLive`.
 */
export const FirebaseCloudMessagingServiceConfigLive: Layer.Layer<
  FirebaseCloudMessagingService,
  never,
  PaymentConfigSecretCrypto
> = Layer.effect(FirebaseCloudMessagingService)(
  Effect.gen(function* () {
    const secretCrypto = yield* PaymentConfigSecretCrypto;
    return makeFirebaseCloudMessagingProvider(secretCrypto);
  }),
);
