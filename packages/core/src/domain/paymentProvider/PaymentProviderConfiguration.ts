/**
 * Payment-provider-configuration domain — typed errors that signal an
 * invariant violation. Row data lives in the `paymentProviderConfigurations`
 * Drizzle table.
 */
import { Schema } from "effect";

/**
 * Provider catalog. Kept here (rather than with the DB schema) because it's
 * a closed enum at the domain level — every code path that branches on
 * provider lists exactly these three.
 */
export const PaymentProviderId = Schema.Literals([
  "apple-app-store",
  "development",
  "google-play",
  "stripe",
]);
export type PaymentProviderId = typeof PaymentProviderId.Type;

/** Configuration row not found. */
export class PaymentProviderConfigurationNotFoundError extends Schema.TaggedErrorClass<PaymentProviderConfigurationNotFoundError>(
  "PaymentProviderConfigurationNotFoundError",
)("PaymentProviderConfigurationNotFoundError", { message: Schema.String }) {}

/** Configuration validation failed (parsing, schema). */
export class PaymentProviderConfigurationValidationError extends Schema.TaggedErrorClass<PaymentProviderConfigurationValidationError>(
  "PaymentProviderConfigurationValidationError",
)("PaymentProviderConfigurationValidationError", { cause: Schema.String }) {}

/** Configuration key collides with an existing live row. */
export class PaymentProviderConfigurationKeyUnavailableError extends Schema.TaggedErrorClass<PaymentProviderConfigurationKeyUnavailableError>(
  "PaymentProviderConfigurationKeyUnavailableError",
)("PaymentProviderConfigurationKeyUnavailableError", { message: Schema.String }) {}

/** A project already has a live configuration for the requested provider. */
export class PaymentProviderAlreadyExistsError extends Schema.TaggedErrorClass<PaymentProviderAlreadyExistsError>(
  "PaymentProviderAlreadyExistsError",
)("PaymentProviderAlreadyExistsError", { message: Schema.String }) {}
