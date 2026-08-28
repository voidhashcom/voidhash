/**
 * Payment-provider-product domain — typed errors that signal an invariant
 * violation on the join row between a `PaymentProviderConfiguration` and a
 * `Product`. Row data lives in the `paymentProviderConfigurationProducts`
 * Drizzle table.
 */
import { Schema } from "effect";

export const PaymentProviderProduct = Schema.Struct({
  configuration: Schema.NullOr(Schema.Record(Schema.String, Schema.Unknown)),
  createdAt: Schema.NullOr(Schema.Date),
  id: Schema.NonEmptyString,
  isActive: Schema.Boolean,
  paymentProviderConfigurationId: Schema.NonEmptyString,
  productId: Schema.NonEmptyString,
  providerProductKey: Schema.NonEmptyString,
  updatedAt: Schema.NullOr(Schema.Date),
});

export const PaymentProviderProducts = Schema.Array(PaymentProviderProduct);

export const ProjectPaymentProviderProduct = Schema.Struct({
  configuration: Schema.NullOr(Schema.Record(Schema.String, Schema.Unknown)),
  id: Schema.NonEmptyString,
  paymentProviderConfigurationId: Schema.NonEmptyString,
  productId: Schema.NonEmptyString,
  providerId: Schema.String,
});

export const ProjectPaymentProviderProducts = Schema.Array(ProjectPaymentProviderProduct);

/** Provider-product row not found. */
export class PaymentProviderProductNotFoundError extends Schema.TaggedErrorClass<PaymentProviderProductNotFoundError>(
  "PaymentProviderProductNotFoundError",
)("PaymentProviderProductNotFoundError", { message: Schema.String }) {}

/** Validation failure on the provider-specific configuration blob. */
export class PaymentProviderProductValidationError extends Schema.TaggedErrorClass<PaymentProviderProductValidationError>(
  "PaymentProviderProductValidationError",
)("PaymentProviderProductValidationError", { message: Schema.String }) {}

export class PaymentProviderProductServiceError extends Schema.TaggedErrorClass<PaymentProviderProductServiceError>(
  "PaymentProviderProductServiceError",
)("PaymentProviderProductServiceError", { cause: Schema.String }) {}
