import * as Schema from "effect/Schema";

/**
 * General error from the Google Play Server API
 */
export class GooglePlayGeneralError extends Schema.TaggedErrorClass<GooglePlayGeneralError>(
  "GooglePlayGeneralError",
)("GooglePlayGeneralError", {
  cause: Schema.optional(Schema.Unknown),
  message: Schema.String,
}) {}

/**
 * Purchase has already been acknowledged
 */
export class GooglePlayPurchaseAlreadyAcknowledgedError extends Schema.TaggedErrorClass<GooglePlayPurchaseAlreadyAcknowledgedError>(
  "GooglePlayPurchaseAlreadyAcknowledgedError",
)("GooglePlayPurchaseAlreadyAcknowledgedError", {
  purchaseToken: Schema.String,
}) {}

/**
 * Purchase has already been consumed
 */
export class GooglePlayPurchaseAlreadyConsumedError extends Schema.TaggedErrorClass<GooglePlayPurchaseAlreadyConsumedError>(
  "GooglePlayPurchaseAlreadyConsumedError",
)("GooglePlayPurchaseAlreadyConsumedError", {
  purchaseToken: Schema.String,
}) {}

/**
 * Subscription has expired
 */
export class GooglePlaySubscriptionExpiredError extends Schema.TaggedErrorClass<GooglePlaySubscriptionExpiredError>(
  "GooglePlaySubscriptionExpiredError",
)("GooglePlaySubscriptionExpiredError", {
  purchaseToken: Schema.String,
  expiryTime: Schema.optional(Schema.String),
}) {}

/**
 * Subscription has been canceled
 */
export class GooglePlaySubscriptionCanceledError extends Schema.TaggedErrorClass<GooglePlaySubscriptionCanceledError>(
  "GooglePlaySubscriptionCanceledError",
)("GooglePlaySubscriptionCanceledError", {
  purchaseToken: Schema.String,
}) {}

/**
 * Failed to verify RTDN notification signature
 */
export class GooglePlayNotificationVerificationError extends Schema.TaggedErrorClass<GooglePlayNotificationVerificationError>(
  "GooglePlayNotificationVerificationError",
)("GooglePlayNotificationVerificationError", {
  message: Schema.String,
}) {}

/**
 * Invalid or malformed RTDN notification
 */
export class GooglePlayInvalidNotificationError extends Schema.TaggedErrorClass<GooglePlayInvalidNotificationError>(
  "GooglePlayInvalidNotificationError",
)("GooglePlayInvalidNotificationError", {
  message: Schema.String,
  rawNotification: Schema.optional(Schema.Unknown),
}) {}

/**
 * Product already exists in Google Play Console
 */
export class GooglePlayProductAlreadyExistsError extends Schema.TaggedErrorClass<GooglePlayProductAlreadyExistsError>(
  "GooglePlayProductAlreadyExistsError",
)("GooglePlayProductAlreadyExistsError", {
  productId: Schema.String,
  packageName: Schema.String,
}) {}

/**
 * Transaction does not contain required product ID
 */
export class GooglePlayTransactionDoesNotContainProductIdError extends Schema.TaggedErrorClass<GooglePlayTransactionDoesNotContainProductIdError>(
  "GooglePlayTransactionDoesNotContainProductIdError",
)("GooglePlayTransactionDoesNotContainProductIdError", {
  message: Schema.String,
}) {}
