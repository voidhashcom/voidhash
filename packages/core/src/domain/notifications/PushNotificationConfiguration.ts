import * as Schema from "effect/Schema";

/**
 * Domain errors for the push-notification configuration aggregate. Mirrors the
 * payment-provider configuration error family but lives in the `push_`
 * namespace to avoid colliding with the entrenched payment-provider webhook
 * domain. The catch-all `NotificationsConfigurationServiceError` is defined in
 * the service file (as with `PaymentProviderConfigurationServiceError`).
 */

/** A config lookup (`getById` / `update`) hit a missing or soft-deleted row. */
export class NotificationConfigNotFoundError extends Schema.TaggedErrorClass<NotificationConfigNotFoundError>(
  "NotificationConfigNotFoundError",
)("NotificationConfigNotFoundError", { message: Schema.String }) {}

/**
 * `validateGlobalConfiguration` failed to decode the provider config schema (or
 * a config-time dry-run rejected it) while enabling a config.
 */
export class NotificationConfigValidationError extends Schema.TaggedErrorClass<NotificationConfigValidationError>(
  "NotificationConfigValidationError",
)("NotificationConfigValidationError", { cause: Schema.String }) {}

/** The derived `pushProviderKey` collides with another active row in the project. */
export class NotificationConfigKeyUnavailableError extends Schema.TaggedErrorClass<NotificationConfigKeyUnavailableError>(
  "NotificationConfigKeyUnavailableError",
)("NotificationConfigKeyUnavailableError", { message: Schema.String }) {}

/**
 * A `send()` was attempted but no enabled `push_notification_config` exists for
 * the project — fails the whole send up-front (distinct from per-device failure).
 */
export class NotificationConfigNotEnabledError extends Schema.TaggedErrorClass<NotificationConfigNotEnabledError>(
  "NotificationConfigNotEnabledError",
)("NotificationConfigNotEnabledError", { message: Schema.String }) {}
