/**
 * Payment-provider-configuration errors — typed errors returned by
 * payment-provider-configuration RPCs. Class names and `_tag` values are
 * namespaced with `Rpc` / `Rpc/`.
 */
import { Schema } from "effect";

/** Configuration row not found. */
export class RpcPaymentProviderConfigurationNotFoundError extends Schema.TaggedErrorClass<RpcPaymentProviderConfigurationNotFoundError>(
  "RpcPaymentProviderConfigurationNotFoundError",
)("Rpc/PaymentProviderConfigurationNotFoundError", { message: Schema.String }) {}

/** Configuration validation failed (parsing, schema). */
export class RpcPaymentProviderConfigurationValidationError extends Schema.TaggedErrorClass<RpcPaymentProviderConfigurationValidationError>(
  "RpcPaymentProviderConfigurationValidationError",
)("Rpc/PaymentProviderConfigurationValidationError", { cause: Schema.String }) {}

/** Configuration key collides with an existing live row. */
export class RpcPaymentProviderConfigurationKeyUnavailableError extends Schema.TaggedErrorClass<RpcPaymentProviderConfigurationKeyUnavailableError>(
  "RpcPaymentProviderConfigurationKeyUnavailableError",
)("Rpc/PaymentProviderConfigurationKeyUnavailableError", { message: Schema.String }) {}

/** A project already has a live configuration for the requested provider. */
export class RpcPaymentProviderAlreadyExistsError extends Schema.TaggedErrorClass<RpcPaymentProviderAlreadyExistsError>(
  "RpcPaymentProviderAlreadyExistsError",
)("Rpc/PaymentProviderAlreadyExistsError", { message: Schema.String }) {}

/**
 * Catch-all payment-provider-configuration service error. Wraps
 * `DatabaseError` and other infrastructural failures at the public-method
 * boundary.
 */
export class RpcPaymentProviderConfigurationServiceError extends Schema.TaggedErrorClass<RpcPaymentProviderConfigurationServiceError>(
  "RpcPaymentProviderConfigurationServiceError",
)("Rpc/PaymentProviderConfigurationServiceError", { cause: Schema.String }) {}
