/**
 * Product-perk errors — typed errors returned by product-perk RPCs (the
 * join row between a `Product` and a `Perk`). Class names and `_tag` values
 * are namespaced with `Rpc` / `Rpc/`.
 */
import * as Schema from "effect/Schema";

/**
 * Catch-all product-perk service error. Wraps `DatabaseError` (and other
 * infrastructural failures) at the public-method boundary so callers see
 * one stable error tag.
 */
export class RpcProductPerkServiceError extends Schema.TaggedErrorClass<RpcProductPerkServiceError>(
  "RpcProductPerkServiceError",
)("Rpc/ProductPerkServiceError", { cause: Schema.String }) {}

/**
 * Validation error raised when an input refers to a missing product, perk,
 * or product-perk row. Distinct from `RpcActionForbiddenError`: the row
 * simply doesn't exist.
 */
export class RpcProductPerkValidationError extends Schema.TaggedErrorClass<RpcProductPerkValidationError>(
  "RpcProductPerkValidationError",
)("Rpc/ProductPerkValidationError", { message: Schema.String }) {}
