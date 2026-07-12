import { Context, Schema, type Effect } from "effect";

import type { NotificationConfigValidationError } from "../../domain/notifications/PushNotificationConfiguration.ts";

/**
 * The delivery-provider seam — a near-verbatim structural mirror of
 * `payment-provider-adapter.ts` / `PaymentProvider.ts`. As there, we expose a
 * type-ERASED {@link PushDeliveryProviderShape} (consumed by
 * `NotificationsConfigurationService` for `defaultGlobalConfiguration` /
 * `validateGlobalConfiguration` / `pushProviderKey` derivation) and a TYPED
 * {@link PushDeliveryProvider} for compile-time config safety inside each
 * adapter. There is deliberately NO "product" tier — push config is
 * project-level only.
 */
export type PushDeliveryProviderKind = "fcm" | "apns";

/** Coarse device discriminator above the adapter boundary. */
export type DevicePlatform = "ios" | "android";

/** APNs environment, part of the dedup key (coalesced to `''` for FCM). */
export type PushEnvironment = "sandbox" | "production";

/** The dereferenced device a UUID resolves to immediately before `deliver`. */
export interface DeviceToken {
  readonly platform: DevicePlatform;
  readonly platformToken: string; // FCM registration token / raw APNs hex
  readonly bundleId?: string; // required for apns
  readonly environment?: PushEnvironment; // apns only
}

/** Expo-shaped unified message; `collapseId` -> apns-collapse-id, `ttl` -> apns-expiration. */
export interface PushMessage {
  readonly title: string;
  readonly body: string;
  readonly data?: Record<string, unknown>;
  readonly sound?: string;
  readonly badge?: number;
  readonly priority?: "default" | "high";
  readonly ttl?: number;
  readonly channelId?: string; // android
  readonly collapseId?: string;
}

/** The ticket `deliver` yields on the success channel — the provider accepted the message. */
export interface PushDeliverySuccess {
  readonly statusCode: number;
  readonly providerMessageId?: string; // FCM message name / APNs apns-id
}

/**
 * The normalized delivery-failure vocabulary, modeled as TAGGED ERRORS on the
 * `deliver` error channel (not a `succeeded` boolean + optional fields). Each is
 * exactly one handling class — `PushDeliveryService` matches on `_tag` with
 * compile-time exhaustiveness, never on provider-specific codes. Misclassifying
 * is unforgiving: terminal-as-retryable burns quota on dead tokens;
 * transient-as-terminal silently deletes live devices.
 *
 * Handling classes:
 *  - terminal-device ({@link PushUnregisteredError}, {@link PushBadTokenError}) —
 *    freshness-gated device invalidate, NEVER retry.
 *  - terminal-payload ({@link PushPayloadTooLargeError}) — Exhausted (413 is authoritative).
 *  - terminal-config ({@link PushInvalidCredentialsError}) — surfaced on config, device NOT deleted.
 *  - unroutable ({@link PushNotImplementedError}) — Failed, never dropped (APNs gate closed).
 *  - retryable ({@link PushRateExceededError}, {@link PushTransientError}) — queue retry,
 *    honoring an explicit `retryAfterSeconds` over the backoff schedule.
 */
export class PushUnregisteredError extends Schema.TaggedErrorClass<PushUnregisteredError>(
  "PushUnregisteredError",
)("PushUnregisteredError", { statusCode: Schema.optional(Schema.Number) }) {}

export class PushBadTokenError extends Schema.TaggedErrorClass<PushBadTokenError>(
  "PushBadTokenError",
)("PushBadTokenError", { statusCode: Schema.optional(Schema.Number) }) {}

export class PushPayloadTooLargeError extends Schema.TaggedErrorClass<PushPayloadTooLargeError>(
  "PushPayloadTooLargeError",
)("PushPayloadTooLargeError", { statusCode: Schema.optional(Schema.Number) }) {}

export class PushInvalidCredentialsError extends Schema.TaggedErrorClass<PushInvalidCredentialsError>(
  "PushInvalidCredentialsError",
)("PushInvalidCredentialsError", { statusCode: Schema.optional(Schema.Number) }) {}

export class PushNotImplementedError extends Schema.TaggedErrorClass<PushNotImplementedError>(
  "PushNotImplementedError",
)("PushNotImplementedError", { statusCode: Schema.optional(Schema.Number) }) {}

export class PushRateExceededError extends Schema.TaggedErrorClass<PushRateExceededError>(
  "PushRateExceededError",
)("PushRateExceededError", {
  statusCode: Schema.optional(Schema.Number),
  retryAfterSeconds: Schema.optional(Schema.Number),
}) {}

export class PushTransientError extends Schema.TaggedErrorClass<PushTransientError>(
  "PushTransientError",
)("PushTransientError", {
  statusCode: Schema.optional(Schema.Number),
  retryAfterSeconds: Schema.optional(Schema.Number),
}) {}

/** The full `deliver` failure channel. */
export type PushDeliveryError =
  | PushUnregisteredError
  | PushBadTokenError
  | PushPayloadTooLargeError
  | PushInvalidCredentialsError
  | PushNotImplementedError
  | PushRateExceededError
  | PushTransientError;

/** Erased shape — config is `Record<string, unknown>` at the boundary. */
export interface PushDeliveryProviderShape<TKind extends PushDeliveryProviderKind> {
  readonly id: TKind;
  readonly title: string;
  readonly defaultGlobalConfiguration: () => Effect.Effect<Record<string, unknown>>;
  readonly validateGlobalConfiguration: (
    configuration: Record<string, unknown>,
  ) => Effect.Effect<
    { readonly parsedConfiguration: Record<string, unknown>; readonly pushProviderKey: string },
    NotificationConfigValidationError
  >;
  /**
   * The secret-omitting dashboard read DTO: the non-secret subset of the
   * config plus `has*` presence flags. Secrets are write-only and NEVER
   * round-tripped to the browser.
   */
  readonly toReadDto: (configuration: Record<string, unknown>) => Record<string, unknown>;
  /**
   * Fail-closed gate helper: returns `true` if any declared secret field is
   * non-empty AND still plaintext (not `v1.aesgcm:`-prefixed) after the encrypt
   * pass — i.e. the encryption key is unset. The config service refuses to
   * enable such a config in production (`PUSH_REQUIRE_ENCRYPTION`).
   */
  readonly hasPlaintextSecret: (configuration: Record<string, unknown>) => boolean;
  /**
   * The send-engine method — resolves a UUID-dereferenced device + message to a
   * ticket ({@link PushDeliverySuccess}) or fails with a normalized
   * {@link PushDeliveryError}. Receives the STORED configuration (secret still
   * encrypted) and decrypts its own secret internally, so the caller never needs
   * to know which field is secret per provider. NEVER DEFECTS — every internal
   * failure (decrypt/JWT/OAuth/network) is mapped onto the error channel, so the
   * consumer classifies on `_tag` alone. APNs fails `PushNotImplementedError`
   * while the HTTP/2-from-Workers gate is closed.
   */
  readonly deliver: (
    configuration: Record<string, unknown>,
    token: DeviceToken,
    message: PushMessage,
  ) => Effect.Effect<PushDeliverySuccess, PushDeliveryError>;
}

export type AnyPushDeliveryProviderShape =
  | PushDeliveryProviderShape<"fcm">
  | PushDeliveryProviderShape<"apns">;

/**
 * Generic, strongly-typed adapter contract. Each adapter engine sees its
 * concrete decrypted-config shape (FCM service-account JSON vs APNs
 * `{teamId, keyId, privateKeyContent, bundleId, environment}`) while the public
 * tag stays erased. The typed counterpart to {@link PushDeliveryProviderShape}.
 */
export interface PushDeliveryProvider<
  TKind extends PushDeliveryProviderKind,
  TConfig extends object,
> {
  readonly id: TKind;
  readonly title: string;
  readonly defaultGlobalConfiguration: () => Effect.Effect<TConfig>;
  readonly validateGlobalConfiguration: (
    configuration: Record<string, unknown>,
  ) => Effect.Effect<
    { readonly parsedConfiguration: TConfig; readonly pushProviderKey: string },
    NotificationConfigValidationError
  >;
  readonly toReadDto: (configuration: Record<string, unknown>) => Record<string, unknown>;
  readonly hasPlaintextSecret: (configuration: Record<string, unknown>) => boolean;
  readonly deliver: (
    configuration: Record<string, unknown>,
    token: DeviceToken,
    message: PushMessage,
  ) => Effect.Effect<PushDeliverySuccess, PushDeliveryError>;
}

/**
 * The two delivery-provider tags. The `deliver` method lives on these SAME tags
 * that also carry config validation — there is no separate "delivery service"
 * indirection. Supplied with their adapter + crypto Layers at app root, exactly
 * like the existing `PaymentProvider` tags. These two class names retain
 * "Notification" by product-owner decision.
 */
export class FirebaseCloudMessagingService extends Context.Service<
  FirebaseCloudMessagingService,
  PushDeliveryProviderShape<"fcm">
>()("FirebaseCloudMessagingService") {}

export class ApplePushNotificationService extends Context.Service<
  ApplePushNotificationService,
  PushDeliveryProviderShape<"apns">
>()("ApplePushNotificationService") {}
