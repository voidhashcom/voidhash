/**
 * Payment-provider-product domain — typed errors that signal an invariant
 * violation on the join row between a `PaymentProviderConfiguration` and a
 * `Product`. Row data lives in the `paymentProviderConfigurationProducts`
 * Drizzle table.
 */
import { Schema } from "effect";

/** Provider-product row not found. */
export class PaymentProviderProductNotFoundError extends Schema.TaggedErrorClass<PaymentProviderProductNotFoundError>(
  "PaymentProviderProductNotFoundError",
)("PaymentProviderProductNotFoundError", { message: Schema.String }) {}

/** Validation failure on the provider-specific configuration blob. */
export class PaymentProviderProductValidationError extends Schema.TaggedErrorClass<PaymentProviderProductValidationError>(
  "PaymentProviderProductValidationError",
)("PaymentProviderProductValidationError", { message: Schema.String }) {}
