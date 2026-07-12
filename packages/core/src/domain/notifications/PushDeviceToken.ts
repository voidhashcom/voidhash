import { Schema } from "effect";

/**
 * Token + message domain types/errors for the push spine. The token-service and
 * person-link-service catch-all errors live in their respective service files
 * (matching the payment/person convention); this module owns the cross-cutting
 * device/message domain errors referenced by the SDK route handlers and the
 * `NotificationTokenService` shape.
 */

/**
 * Raised by `resolveForDelivery` and by ownership-asserting `refresh` /
 * `unregister`. The SDK route maps it to a UNIFORM 404 for both "no such token"
 * AND "not your token", so there is no existence oracle.
 */
export class PushDeviceTokenNotFoundError extends Schema.TaggedErrorClass<PushDeviceTokenNotFoundError>(
  "PushDeviceTokenNotFoundError",
)("PushDeviceTokenNotFoundError", { message: Schema.String }) {}

/**
 * A registration payload was malformed (e.g. `provider='apns'` without a
 * `bundleId`/`environment`, or an empty `platformToken`).
 */
export class InvalidPushMessageError extends Schema.TaggedErrorClass<InvalidPushMessageError>(
  "InvalidPushMessageError",
)("InvalidPushMessageError", { message: Schema.String }) {}

/**
 * Internal-only: the caller is not the device's active owner. NEVER surfaced
 * distinctly — the route collapses it into {@link PushDeviceTokenNotFoundError}
 * to preserve the no-oracle guarantee.
 */
export class DeviceOwnershipError extends Schema.TaggedErrorClass<DeviceOwnershipError>(
  "DeviceOwnershipError",
)("DeviceOwnershipError", { message: Schema.String }) {}
