/**
 * Payment-provider-product errors — typed errors returned by
 * payment-provider-product RPCs (the join row between a
 * `PaymentProviderConfiguration` and a `Product`). Class names and `_tag`
 * values are namespaced with `Rpc` / `Rpc/`.
 */
import * as Schema from "effect/Schema";

/** Provider-product row not found. */
export class RpcPaymentProviderProductNotFoundError extends Schema.TaggedErrorClass<RpcPaymentProviderProductNotFoundError>(
  "RpcPaymentProviderProductNotFoundError",
)("Rpc/PaymentProviderProductNotFoundError", { message: Schema.String }) {}

/** Validation failure on the provider-specific configuration blob. */
export class RpcPaymentProviderProductValidationError extends Schema.TaggedErrorClass<RpcPaymentProviderProductValidationError>(
  "RpcPaymentProviderProductValidationError",
)("Rpc/PaymentProviderProductValidationError", { message: Schema.String }) {}

/**
 * Catch-all payment-provider-product service error. Wraps `DatabaseError`
 * and other infrastructural failures at the public-method boundary.
 */
export class RpcPaymentProviderProductServiceError extends Schema.TaggedErrorClass<RpcPaymentProviderProductServiceError>(
  "RpcPaymentProviderProductServiceError",
)("Rpc/PaymentProviderProductServiceError", { cause: Schema.String }) {}
