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
import { Effect, Layer, Schema } from "effect";

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

const FCM_DEFAULT_CONFIGURATION = {
  projectId: "",
  serviceAccountJson: "",
  androidPriority: "normal",
  androidTtl: "2419200s", // 28d, the FCM max
  apnsPriority: "10",
} as const satisfies Record<string, unknown>;

const FCM_OAUTH_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const FCM_DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token";
const FCM_SEND_TIMEOUT_MS = 15_000;
/** Refresh a cached OAuth token this many seconds before its stated expiry. */
const FCM_TOKEN_REFRESH_SKEW_SECONDS = 60;

const readString = (configuration: Record<string, unknown>, key: string): string => {
  const value = configuration[key];
  return typeof value === "string" ? value : "";
};

/** Parsed service-account credentials extracted from the config secret JSON. */
interface ServiceAccount {
  readonly clientEmail: string;
  readonly privateKey: string;
  readonly tokenUri: string;
}

const parseServiceAccount = (json: string): ServiceAccount => {
  const parsed = JSON.parse(json) as {
    client_email?: unknown;
    private_key?: unknown;
    token_uri?: unknown;
  };
  const clientEmail = typeof parsed.client_email === "string" ? parsed.client_email : "";
  const privateKey = typeof parsed.private_key === "string" ? parsed.private_key : "";
  if (clientEmail.length === 0 || privateKey.length === 0) {
    throw new Error("service-account JSON missing client_email or private_key");
  }
  return {
    clientEmail,
    privateKey,
    tokenUri: typeof parsed.token_uri === "string" ? parsed.token_uri : FCM_DEFAULT_TOKEN_URI,
  };
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
  const data =
    message.data === undefined
      ? undefined
      : Object.fromEntries(
          Object.entries(message.data).map(([key, value]) => [
            key,
            typeof value === "string" ? value : JSON.stringify(value),
          ]),
        );

  const android: Record<string, unknown> = {
    priority: message.priority === "high" ? "HIGH" : "NORMAL",
  };
  if (options.androidTtl) {
    android.ttl = options.androidTtl;
  }
  if (message.collapseId) {
    android.collapse_key = message.collapseId;
  }
  if (message.channelId || message.sound) {
    android.notification = {
      ...(message.channelId ? { channel_id: message.channelId } : {}),
      ...(message.sound ? { sound: message.sound } : {}),
    };
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

  return {
    message: {
      token: fcmToken,
      notification: { title: message.title, body: message.body },
      ...(data ? { data } : {}),
      android,
      apns: { headers: apnsHeaders, payload: { aps } },
    },
  };
};

/**
 * Classify an FCM `messages:send` HTTP response onto the normalized error
 * vocabulary — pure so the (terminal vs retryable) decision is directly tested.
 * FCM v1 carries the canonical error in `error.details[].errorCode`, falling back
 * to `error.status`. Misclassification is unforgiving (see the enum docs), so the
 * mapping is explicit and conservative: unknown 4xx is terminal `BadToken`,
 * unknown 5xx is retryable `Transient`.
 */
export const classifyFcmResult = (
  statusCode: number,
  bodyText: string,
  retryAfterSeconds?: number,
): Effect.Effect<PushDeliverySuccess, PushDeliveryError> => {
  if (statusCode >= 200 && statusCode < 300) {
    let providerMessageId: string | undefined;
    try {
      const parsed = JSON.parse(bodyText) as { name?: unknown };
      providerMessageId = typeof parsed.name === "string" ? parsed.name : undefined;
    } catch {
      providerMessageId = undefined;
    }
    return Effect.succeed({ statusCode, providerMessageId });
  }

  let errorCode = "";
  try {
    const parsed = JSON.parse(bodyText) as {
      error?: { status?: unknown; details?: ReadonlyArray<{ errorCode?: unknown }> };
    };
    const detailCode = parsed.error?.details?.find(
      (detail) => typeof detail?.errorCode === "string",
    )?.errorCode;
    errorCode =
      (typeof detailCode === "string" ? detailCode : undefined) ??
      (typeof parsed.error?.status === "string" ? parsed.error.status : "") ??
      "";
  } catch {
    errorCode = "";
  }

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

const parseRetryAfterSeconds = (headerValue: string | null): number | undefined => {
  if (!headerValue) {
    return undefined;
  }
  const asSeconds = Number(headerValue);
  return Number.isFinite(asSeconds) && asSeconds >= 0 ? asSeconds : undefined;
};

interface CachedAccessToken {
  readonly token: string;
  readonly expiresAtEpochMs: number;
}

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
      const nowSeconds = Math.floor(Date.now() / 1000);
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

      const response = yield* Effect.tryPromise({
        try: () =>
          fetch(account.tokenUri, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
              assertion: jwt,
            }).toString(),
          }),
        catch: () => new PushTransientError({}),
      });
      const bodyText = yield* Effect.promise(() => response.text().catch(() => ""));
      if (!response.ok) {
        // 4xx from the token endpoint means the credentials are bad (terminal
        // config); 5xx is a transient Google outage.
        return yield* Effect.fail(
          response.status >= 500
            ? new PushTransientError({ statusCode: response.status })
            : new PushInvalidCredentialsError({ statusCode: response.status }),
        );
      }
      // Guard the parse: a non-JSON token response must NOT throw a defect (the
      // consumer recovers typed errors from `deliver`, never defects).
      const parsed = yield* Effect.try({
        try: () => JSON.parse(bodyText) as { access_token?: unknown; expires_in?: unknown },
        catch: () => new PushInvalidCredentialsError({}),
      });
      const accessToken = typeof parsed.access_token === "string" ? parsed.access_token : "";
      if (accessToken.length === 0) {
        return yield* Effect.fail(new PushInvalidCredentialsError({}));
      }
      const expiresIn = typeof parsed.expires_in === "number" ? parsed.expires_in : 3600;
      tokenCache.set(account.clientEmail, {
        token: accessToken,
        expiresAtEpochMs: Date.now() + expiresIn * 1000,
      });
      return accessToken;
    });

  const getAccessToken = (
    account: ServiceAccount,
    forceRefresh: boolean,
  ): Effect.Effect<string, PushDeliveryError> => {
    if (!forceRefresh) {
      const cached = tokenCache.get(account.clientEmail);
      if (cached && cached.expiresAtEpochMs - FCM_TOKEN_REFRESH_SKEW_SECONDS * 1000 > Date.now()) {
        return Effect.succeed(cached.token);
      }
    } else {
      tokenCache.delete(account.clientEmail);
    }
    return fetchAccessToken(account);
  };

  const sendOnce = (
    projectId: string,
    accessToken: string,
    body: Record<string, unknown>,
  ): Effect.Effect<
    { readonly status: number; readonly bodyText: string; readonly retryAfter?: number },
    PushDeliveryError
  > =>
    Effect.gen(function* () {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FCM_SEND_TIMEOUT_MS);
      // `tryPromise` (not `promise`): a network error or the AbortController
      // timeout rejects — map it to a RETRYABLE typed error, never a defect that
      // escapes the `deliver` error channel.
      return yield* Effect.tryPromise({
        try: async () => {
          try {
            const response = await fetch(
              `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
                signal: controller.signal,
              },
            );
            const bodyText = await response.text().catch(() => "");
            return {
              status: response.status,
              bodyText,
              retryAfter: parseRetryAfterSeconds(response.headers.get("Retry-After")),
            };
          } finally {
            clearTimeout(timeout);
          }
        },
        catch: () => new PushTransientError({}),
      });
    });

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
      const account = yield* Effect.try({
        try: () => parseServiceAccount(secretJson),
        catch: () => new PushInvalidCredentialsError({}),
      });

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
