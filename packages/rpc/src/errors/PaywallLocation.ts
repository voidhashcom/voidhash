/**
 * Paywall-location errors — typed errors returned by paywall-location RPCs.
 * Class names and `_tag` values are namespaced with `Rpc` / `Rpc/`.
 */
import * as Schema from "effect/Schema";

/** Location row not found in the database. */
export class RpcPaywallLocationNotFoundError extends Schema.TaggedErrorClass<RpcPaywallLocationNotFoundError>(
  "RpcPaywallLocationNotFoundError",
)("Rpc/PaywallLocationNotFoundError", { message: Schema.String }) {}

/** Slug uniqueness invariant violated within a project. */
export class RpcPaywallLocationSlugAlreadyExistsError extends Schema.TaggedErrorClass<RpcPaywallLocationSlugAlreadyExistsError>(
  "RpcPaywallLocationSlugAlreadyExistsError",
)("Rpc/PaywallLocationSlugAlreadyExistsError", { slug: Schema.String }) {}

/** Showing-assignment input failed validation (missing paywall, archived location, …). */
export class RpcPaywallLocationShowingValidationError extends Schema.TaggedErrorClass<RpcPaywallLocationShowingValidationError>(
  "RpcPaywallLocationShowingValidationError",
)("Rpc/PaywallLocationShowingValidationError", { message: Schema.String }) {}

/**
 * Catch-all paywall-location service error. Wraps `DatabaseError` and other
 * infrastructural failures at the public-method boundary.
 */
export class RpcPaywallLocationServiceError extends Schema.TaggedErrorClass<RpcPaywallLocationServiceError>(
  "RpcPaywallLocationServiceError",
)("Rpc/PaywallLocationServiceError", { cause: Schema.String }) {}
