import * as Schema from "effect/Schema";

/**
 * Push-namespaced API errors (avoids colliding with the entrenched
 * `paymentProviderNotification` webhook domain). Same shape as `errors/Sdk.ts`.
 */

/** Generic push-device service error. */
export class ApiPushDeviceServiceError extends Schema.TaggedErrorClass<ApiPushDeviceServiceError>()(
  "Api/PushDeviceServiceError",
  { cause: Schema.String },
  { httpApiStatus: 500 },
) {}

/** Invalid registration payload (bad provider/platform combo, malformed token). */
export class ApiPushDeviceValidationError extends Schema.TaggedErrorClass<ApiPushDeviceValidationError>()(
  "Api/PushDeviceValidationError",
  { message: Schema.String },
  { httpApiStatus: 400 },
) {}

/**
 * UNIFORM 404 for both "no such token" AND "not your token" — refresh/unregister
 * ownership failures map here so there is no existence oracle.
 */
export class ApiPushDeviceNotFoundError extends Schema.TaggedErrorClass<ApiPushDeviceNotFoundError>()(
  "Api/PushDeviceNotFoundError",
  { message: Schema.String },
  { httpApiStatus: 404 },
) {}

/** Dashboard push-config service error (config RPC surface; wired in a later slice). */
export class ApiPushNotificationConfigurationServiceError extends Schema.TaggedErrorClass<ApiPushNotificationConfigurationServiceError>()(
  "Api/PushNotificationConfigurationServiceError",
  { cause: Schema.String },
  { httpApiStatus: 500 },
) {}

/** Dashboard push-config not-found (config RPC surface; wired in a later slice). */
export class ApiPushNotificationConfigurationNotFoundError extends Schema.TaggedErrorClass<ApiPushNotificationConfigurationNotFoundError>()(
  "Api/PushNotificationConfigurationNotFoundError",
  { message: Schema.String },
  { httpApiStatus: 404 },
) {}

/** Server-to-server push send failed (infrastructure / downstream). */
export class ApiPushSendServiceError extends Schema.TaggedErrorClass<ApiPushSendServiceError>()(
  "Api/PushSendServiceError",
  { cause: Schema.String },
  { httpApiStatus: 500 },
) {}

/**
 * A send was attempted but the project has no enabled push provider — a
 * precondition failure (configure FCM/APNs first), not a per-device error.
 */
export class ApiPushSendNotEnabledError extends Schema.TaggedErrorClass<ApiPushSendNotEnabledError>()(
  "Api/PushSendNotEnabledError",
  { message: Schema.String },
  { httpApiStatus: 409 },
) {}

/** Dashboard push-config validation failure (bad/incomplete credentials). */
export class ApiPushNotificationConfigurationValidationError extends Schema.TaggedErrorClass<ApiPushNotificationConfigurationValidationError>()(
  "Api/PushNotificationConfigurationValidationError",
  { cause: Schema.String },
  { httpApiStatus: 400 },
) {}

/** The derived push provider key collides with another active configuration. */
export class ApiPushNotificationConfigurationKeyUnavailableError extends Schema.TaggedErrorClass<ApiPushNotificationConfigurationKeyUnavailableError>()(
  "Api/PushNotificationConfigurationKeyUnavailableError",
  { message: Schema.String },
  { httpApiStatus: 409 },
) {}

/** Read-side send-history service error. */
export class ApiPushNotificationSendServiceError extends Schema.TaggedErrorClass<ApiPushNotificationSendServiceError>()(
  "Api/PushNotificationSendServiceError",
  { cause: Schema.String },
  { httpApiStatus: 500 },
) {}

/** A send id did not resolve to a row owned by the resolved project. */
export class ApiPushNotificationSendNotFoundError extends Schema.TaggedErrorClass<ApiPushNotificationSendNotFoundError>()(
  "Api/PushNotificationSendNotFoundError",
  { message: Schema.String },
  { httpApiStatus: 404 },
) {}
