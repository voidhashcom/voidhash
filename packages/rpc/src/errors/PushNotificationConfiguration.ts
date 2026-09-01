/**
 * Push-notification-configuration errors — typed errors returned by the
 * push-notification config RPCs (the studio surface for FCM/APNs credentials).
 * Class names and `_tag` values are namespaced with `Rpc` / `Rpc/`. Kept in the
 * `push` namespace to avoid colliding with the entrenched payment-provider
 * webhook "notification" domain.
 */
import * as Schema from "effect/Schema";

/** Configuration row not found. */
export class RpcPushNotificationConfigurationNotFoundError extends Schema.TaggedErrorClass<RpcPushNotificationConfigurationNotFoundError>(
  "RpcPushNotificationConfigurationNotFoundError",
)("Rpc/PushNotificationConfigurationNotFoundError", { message: Schema.String }) {}

/** Configuration validation failed (schema decode, secret encryption gate). */
export class RpcPushNotificationConfigurationValidationError extends Schema.TaggedErrorClass<RpcPushNotificationConfigurationValidationError>(
  "RpcPushNotificationConfigurationValidationError",
)("Rpc/PushNotificationConfigurationValidationError", { cause: Schema.String }) {}

/** Derived push-provider key collides with an existing live row. */
export class RpcPushNotificationConfigurationKeyUnavailableError extends Schema.TaggedErrorClass<RpcPushNotificationConfigurationKeyUnavailableError>(
  "RpcPushNotificationConfigurationKeyUnavailableError",
)("Rpc/PushNotificationConfigurationKeyUnavailableError", { message: Schema.String }) {}

/**
 * Catch-all push-notification-configuration service error. Wraps
 * infrastructural failures (and the fail-closed encryption-gate refusal) at the
 * public-method boundary.
 */
export class RpcPushNotificationConfigurationServiceError extends Schema.TaggedErrorClass<RpcPushNotificationConfigurationServiceError>(
  "RpcPushNotificationConfigurationServiceError",
)("Rpc/PushNotificationConfigurationServiceError", { cause: Schema.String }) {}
