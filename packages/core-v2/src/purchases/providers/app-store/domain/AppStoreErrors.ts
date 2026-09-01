import * as Schema from "effect/Schema";

/**
 * Catch-all service error for unexpected/infrastructural failures. Business
 * logic failures raised by App Store services should use one of the dedicated
 * errors below instead.
 */
export class AppStorePaymentProviderServiceError extends Schema.TaggedErrorClass<AppStorePaymentProviderServiceError>(
  "AppStorePaymentProviderServiceError",
)("AppStorePaymentProviderServiceError", {
  cause: Schema.String,
  /**
   * `not_found` marks a missing/soft-deleted configuration or project so the
   * ingress route can answer 404 instead of a retry-forever 500 — mirrors
   * `StripePaymentProviderServiceError.kind`. Absent means transient.
   */
  kind: Schema.optional(Schema.Literals(["not_found", "transient"])),
}) {}

/**
 * The project's App Store payment provider configuration is missing or
 * disabled for the given bundle id.
 */
export class AppStorePaymentProviderNotEnabledForFollowingBundleIdError extends Schema.TaggedErrorClass<AppStorePaymentProviderNotEnabledForFollowingBundleIdError>(
  "AppStorePaymentProviderNotEnabledForFollowingBundleIdError",
)("AppStorePaymentProviderNotEnabledForFollowingBundleIdError", { bundleId: Schema.String }) {}

export class AppStorePaymentProviderConfigurationNotFoundError extends Schema.TaggedErrorClass<AppStorePaymentProviderConfigurationNotFoundError>(
  "AppStorePaymentProviderConfigurationNotFoundError",
)("AppStorePaymentProviderConfigurationNotFoundError", {
  paymentProviderConfigurationId: Schema.String,
}) {}

export class AppStorePaymentProviderProjectNotFoundError extends Schema.TaggedErrorClass<AppStorePaymentProviderProjectNotFoundError>(
  "AppStorePaymentProviderProjectNotFoundError",
)("AppStorePaymentProviderProjectNotFoundError", { projectId: Schema.String }) {}

export class AppStorePaymentProviderProductNotMappedError extends Schema.TaggedErrorClass<AppStorePaymentProviderProductNotMappedError>(
  "AppStorePaymentProviderProductNotMappedError",
)("AppStorePaymentProviderProductNotMappedError", {
  paymentProviderConfigurationId: Schema.String,
  providerProductKey: Schema.String,
}) {}

/**
 * @deprecated Apple-valid transactions with missing provider fields are now
 * accepted and ignored when they cannot be mapped into Voidhash purchase state.
 */
export class AppStorePaymentProviderTransactionMissingRequiredFieldError extends Schema.TaggedErrorClass<AppStorePaymentProviderTransactionMissingRequiredFieldError>(
  "AppStorePaymentProviderTransactionMissingRequiredFieldError",
)("AppStorePaymentProviderTransactionMissingRequiredFieldError", { field: Schema.String }) {}

export class AppStorePaymentProviderTransactionMissingPersonIdentifierError extends Schema.TaggedErrorClass<AppStorePaymentProviderTransactionMissingPersonIdentifierError>(
  "AppStorePaymentProviderTransactionMissingPersonIdentifierError",
)("AppStorePaymentProviderTransactionMissingPersonIdentifierError", {
  providerTransactionId: Schema.String,
}) {}

export class AppStorePaymentProviderSdkTransactionMissingDistinctIdError extends Schema.TaggedErrorClass<AppStorePaymentProviderSdkTransactionMissingDistinctIdError>(
  "AppStorePaymentProviderSdkTransactionMissingDistinctIdError",
)("AppStorePaymentProviderSdkTransactionMissingDistinctIdError", {
  providerTransactionId: Schema.String,
}) {}

export class AppStorePaymentProviderNotificationMissingSignedTransactionInfoError extends Schema.TaggedErrorClass<AppStorePaymentProviderNotificationMissingSignedTransactionInfoError>(
  "AppStorePaymentProviderNotificationMissingSignedTransactionInfoError",
)("AppStorePaymentProviderNotificationMissingSignedTransactionInfoError", {
  paymentProviderConfigurationId: Schema.String,
}) {}

/**
 * Raised when the per-event idempotency key cannot be derived from the
 * decoded transaction (the JWS lacks the anchor date or anchor id required
 * for the given event type). Always indicates an upstream bug: malformed
 * JWS, a notification→eventType mapping that doesn't match Apple's payload
 * for that event, or Apple changed their schema. No silent fallback — the
 * webhook handler propagates this so the request fails loudly.
 */
export class AppStorePurchaseProcessingIdempotencyKeyDerivationError extends Schema.TaggedErrorClass<AppStorePurchaseProcessingIdempotencyKeyDerivationError>(
  "AppStorePurchaseProcessingIdempotencyKeyDerivationError",
)("AppStorePurchaseProcessingIdempotencyKeyDerivationError", {
  eventType: Schema.String,
  missingField: Schema.String,
  providerTransactionId: Schema.optional(Schema.String),
}) {}
