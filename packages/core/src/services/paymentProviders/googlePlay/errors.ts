import { Schema } from "effect";

/**
 * Catch-all service error for unexpected/infrastructural failures. Business
 * logic failures raised by Google Play services should use one of the dedicated
 * errors below instead. Mirrors the App Store error taxonomy.
 */
export class GooglePlayPaymentProviderServiceError extends Schema.TaggedErrorClass<GooglePlayPaymentProviderServiceError>(
  "GooglePlayPaymentProviderServiceError",
)("GooglePlayPaymentProviderServiceError", { cause: Schema.String }) {}

/**
 * The project's Google Play payment provider configuration is missing or
 * disabled for the given package name.
 */
export class GooglePlayPaymentProviderNotEnabledForFollowingPackageNameError extends Schema.TaggedErrorClass<GooglePlayPaymentProviderNotEnabledForFollowingPackageNameError>(
  "GooglePlayPaymentProviderNotEnabledForFollowingPackageNameError",
)("GooglePlayPaymentProviderNotEnabledForFollowingPackageNameError", {
  packageName: Schema.String,
}) {}

export class GooglePlayPaymentProviderConfigurationNotFoundError extends Schema.TaggedErrorClass<GooglePlayPaymentProviderConfigurationNotFoundError>(
  "GooglePlayPaymentProviderConfigurationNotFoundError",
)("GooglePlayPaymentProviderConfigurationNotFoundError", {
  paymentProviderConfigurationId: Schema.String,
}) {}

export class GooglePlayPaymentProviderProjectNotFoundError extends Schema.TaggedErrorClass<GooglePlayPaymentProviderProjectNotFoundError>(
  "GooglePlayPaymentProviderProjectNotFoundError",
)("GooglePlayPaymentProviderProjectNotFoundError", { projectId: Schema.String }) {}

export class GooglePlayPaymentProviderProductNotMappedError extends Schema.TaggedErrorClass<GooglePlayPaymentProviderProductNotMappedError>(
  "GooglePlayPaymentProviderProductNotMappedError",
)("GooglePlayPaymentProviderProductNotMappedError", {
  paymentProviderConfigurationId: Schema.String,
  providerProductKey: Schema.String,
}) {}

export class GooglePlayPaymentProviderTransactionMissingPersonIdentifierError extends Schema.TaggedErrorClass<GooglePlayPaymentProviderTransactionMissingPersonIdentifierError>(
  "GooglePlayPaymentProviderTransactionMissingPersonIdentifierError",
)("GooglePlayPaymentProviderTransactionMissingPersonIdentifierError", {
  purchaseToken: Schema.String,
}) {}

export class GooglePlayPaymentProviderSdkTransactionMissingDistinctIdError extends Schema.TaggedErrorClass<GooglePlayPaymentProviderSdkTransactionMissingDistinctIdError>(
  "GooglePlayPaymentProviderSdkTransactionMissingDistinctIdError",
)("GooglePlayPaymentProviderSdkTransactionMissingDistinctIdError", {
  purchaseToken: Schema.String,
}) {}

/**
 * Raised when the per-event idempotency key cannot be derived from the
 * fetched purchase state (the Play API response lacks the anchor id or anchor
 * date required for the given event type). Always indicates an upstream bug:
 * a malformed Play response, a notification→eventType mapping that doesn't
 * match the payload for that event, or Google changed their schema. No silent
 * fallback — the webhook handler propagates this so the request fails loudly.
 */
export class GooglePlayPurchaseProcessingIdempotencyKeyDerivationError extends Schema.TaggedErrorClass<GooglePlayPurchaseProcessingIdempotencyKeyDerivationError>(
  "GooglePlayPurchaseProcessingIdempotencyKeyDerivationError",
)("GooglePlayPurchaseProcessingIdempotencyKeyDerivationError", {
  eventType: Schema.String,
  missingField: Schema.String,
  purchaseToken: Schema.optional(Schema.String),
}) {}
