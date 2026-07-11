/**
 * Product errors — typed errors returned by product RPCs (product not found
 * / slug conflicts) plus the catch-all service error. Class names and
 * `_tag` values are namespaced with `Rpc` / `Rpc/`.
 */
import { Schema } from "effect";

/** Product row not found in the database. */
export class RpcProductNotFoundError extends Schema.TaggedErrorClass<RpcProductNotFoundError>(
  "RpcProductNotFoundError",
)("Rpc/ProductNotFoundError", { message: Schema.String }) {}

/** Product slug uniqueness invariant violated within a project. */
export class RpcProductSlugAlreadyExistsError extends Schema.TaggedErrorClass<RpcProductSlugAlreadyExistsError>(
  "RpcProductSlugAlreadyExistsError",
)("Rpc/ProductSlugAlreadyExistsError", { slug: Schema.String }) {}

/**
 * Catch-all product service error. Wraps `DatabaseError` (and other
 * infrastructural failures) at the public-method boundary so callers see
 * one stable error tag.
 */
export class RpcProductServiceError extends Schema.TaggedErrorClass<RpcProductServiceError>(
  "RpcProductServiceError",
)("Rpc/ProductServiceError", { cause: Schema.String }) {}
