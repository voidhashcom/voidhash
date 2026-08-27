import { Schema } from "effect";

/**
 * Purchase or subscription not found (404)
 */
export class GooglePlayPurchaseNotFoundError extends Schema.TaggedErrorClass<GooglePlayPurchaseNotFoundError>(
  "GooglePlayPurchaseNotFoundError",
)("GooglePlayPurchaseNotFoundError", {
  purchaseToken: Schema.String,
  packageName: Schema.String,
}) {}

/**
 * Unauthorized - Invalid credentials (401)
 */
export class GooglePlayUnauthorizedError extends Schema.TaggedErrorClass<GooglePlayUnauthorizedError>(
  "GooglePlayUnauthorizedError",
)("GooglePlayUnauthorizedError", {
  message: Schema.String,
}) {}

/**
 * Forbidden - Insufficient permissions (403)
 */
export class GooglePlayForbiddenError extends Schema.TaggedErrorClass<GooglePlayForbiddenError>(
  "GooglePlayForbiddenError",
)("GooglePlayForbiddenError", {
  message: Schema.String,
}) {}

/**
 * Rate limit exceeded (429)
 */
export class GooglePlayRateLimitExceededError extends Schema.TaggedErrorClass<GooglePlayRateLimitExceededError>(
  "GooglePlayRateLimitExceededError",
)("GooglePlayRateLimitExceededError", {
  message: Schema.String,
  retryAfterSeconds: Schema.optional(Schema.Number),
}) {}

/**
 * Invalid request (400)
 */
export class GooglePlayInvalidRequestError extends Schema.TaggedErrorClass<GooglePlayInvalidRequestError>(
  "GooglePlayInvalidRequestError",
)("GooglePlayInvalidRequestError", {
  message: Schema.String,
  details: Schema.optional(Schema.Unknown),
}) {}

/**
 * Subscription product not found in Google Play Console
 */
export class GooglePlaySubscriptionNotFoundError extends Schema.TaggedErrorClass<GooglePlaySubscriptionNotFoundError>(
  "GooglePlaySubscriptionNotFoundError",
)("GooglePlaySubscriptionNotFoundError", {
  productId: Schema.String,
  packageName: Schema.String,
}) {}

/**
 * Product not found in Google Play Console
 */
export class GooglePlayProductNotFoundError extends Schema.TaggedErrorClass<GooglePlayProductNotFoundError>(
  "GooglePlayProductNotFoundError",
)("GooglePlayProductNotFoundError", {
  productId: Schema.String,
  packageName: Schema.String,
}) {}

/**
 * Server API error from Google Play
 */
export class GooglePlayServerAPIError extends Schema.TaggedErrorClass<GooglePlayServerAPIError>(
  "GooglePlayServerAPIError",
)("GooglePlayServerAPIError", {
  message: Schema.String,
}) {}
