import { Schema } from "effect";

/**
 * Public-boundary error for the Stripe payment-provider path. The webhook
 * handler collapses every internal failure into this single error so the public
 * service contract stays narrow; `kind` carries the routing hint the ingress
 * route maps to an HTTP status:
 *   - `signature` → 400 (bad/again-bad signature; permanent, surfaced in Stripe),
 *   - `not_found` → 404 (unknown configuration/project; permanent),
 *   - `transient` → 500 (DB/Stripe-API/infra; Stripe retries).
 * Defaults to `transient` when constructed without a kind.
 */
export class StripePaymentProviderServiceError extends Schema.TaggedErrorClass<StripePaymentProviderServiceError>(
  "StripePaymentProviderServiceError",
)("StripePaymentProviderServiceError", {
  cause: Schema.String,
  kind: Schema.optional(Schema.Literals(["signature", "not_found", "transient"])),
}) {}

/** The referenced payment-provider configuration row is missing or soft-deleted. */
export class StripePaymentProviderConfigurationNotFoundError extends Schema.TaggedErrorClass<StripePaymentProviderConfigurationNotFoundError>(
  "StripePaymentProviderConfigurationNotFoundError",
)("StripePaymentProviderConfigurationNotFoundError", {
  paymentProviderConfigurationId: Schema.String,
}) {}

/** The project owning the configuration could not be found. */
export class StripePaymentProviderProjectNotFoundError extends Schema.TaggedErrorClass<StripePaymentProviderProjectNotFoundError>(
  "StripePaymentProviderProjectNotFoundError",
)("StripePaymentProviderProjectNotFoundError", { projectId: Schema.String }) {}

/**
 * The Stripe price/product referenced by the event has no active
 * `payment_provider_configuration_product` mapping yet. The webhook handler
 * intercepts this to park the raw event for replay once the mapping appears.
 * `providerProductKey` is the `"${product}:${price}"` key (matching
 * `stripe/config-provider.ts` `createProductKey`).
 */
export class StripePaymentProviderProductNotMappedError extends Schema.TaggedErrorClass<StripePaymentProviderProductNotMappedError>(
  "StripePaymentProviderProductNotMappedError",
)("StripePaymentProviderProductNotMappedError", {
  paymentProviderConfigurationId: Schema.String,
  providerProductKey: Schema.String,
}) {}

/**
 * A refund, reversal, or dispute arrived before its original transaction was
 * recorded. The webhook handler parks the raw event and retries it after the
 * purchase path catches up.
 */
export class StripePaymentProviderTransactionNotFoundError extends Schema.TaggedErrorClass<StripePaymentProviderTransactionNotFoundError>(
  "StripePaymentProviderTransactionNotFoundError",
)("StripePaymentProviderTransactionNotFoundError", {
  candidateKeys: Schema.Array(Schema.String),
  eventId: Schema.String,
}) {}

/**
 * The Stripe webhook signature could not be verified against either the live or
 * the test signing secret (bad signature, wrong secret, or stale timestamp).
 * Surfaced by the ingress route as a 400 so the misconfiguration is visible in
 * the Stripe dashboard rather than retried indefinitely.
 */
export class StripeWebhookSignatureError extends Schema.TaggedErrorClass<StripeWebhookSignatureError>(
  "StripeWebhookSignatureError",
)("StripeWebhookSignatureError", { reason: Schema.String }) {}

/**
 * Raised when the per-event idempotency key cannot be derived from the decoded
 * Stripe object (a required anchor id/timestamp is absent). Always indicates an
 * upstream bug or a Stripe schema change — no silent fallback; the webhook
 * handler collapses it into a `"failed"` notification-ledger row.
 */
export class StripePurchaseProcessingIdempotencyKeyDerivationError extends Schema.TaggedErrorClass<StripePurchaseProcessingIdempotencyKeyDerivationError>(
  "StripePurchaseProcessingIdempotencyKeyDerivationError",
)("StripePurchaseProcessingIdempotencyKeyDerivationError", {
  eventType: Schema.String,
  missingField: Schema.String,
}) {}
