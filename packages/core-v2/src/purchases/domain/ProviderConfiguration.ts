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

export const PaymentProviderConfiguration = Schema.Struct({
  activeProviderId: Schema.NullOr(Schema.String),
  configuration: Schema.NullOr(Schema.Record(Schema.String, Schema.Unknown)),
  createdAt: Schema.NullOr(Schema.Date),
  deletedAt: Schema.NullOr(Schema.Date),
  enabled: Schema.Boolean,
  id: Schema.NonEmptyString,
  name: Schema.String,
  paymentProviderKey: Schema.String,
  projectId: Schema.NonEmptyString,
  providerId: Schema.String,
  updatedAt: Schema.NullOr(Schema.Date),
});

export const PaymentProviderConfigurations = Schema.Array(PaymentProviderConfiguration);

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

/**
 * The configuration still has dependent product mappings, so deleting it would
 * dangle them. A caller-correctable precondition, not a server fault: remove
 * the mappings first.
 */
export class PaymentProviderConfigurationInUseError extends Schema.TaggedErrorClass<PaymentProviderConfigurationInUseError>(
  "PaymentProviderConfigurationInUseError",
)("PaymentProviderConfigurationInUseError", { message: Schema.String }) {}

/** A project already has a live configuration for the requested provider. */
export class PaymentProviderAlreadyExistsError extends Schema.TaggedErrorClass<PaymentProviderAlreadyExistsError>(
  "PaymentProviderAlreadyExistsError",
)("PaymentProviderAlreadyExistsError", { message: Schema.String }) {}

export class PaymentProviderConfigurationServiceError extends Schema.TaggedErrorClass<PaymentProviderConfigurationServiceError>(
  "PaymentProviderConfigurationServiceError",
)("PaymentProviderConfigurationServiceError", { cause: Schema.String }) {}
