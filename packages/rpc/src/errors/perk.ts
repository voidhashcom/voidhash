/**
 * Perk errors — typed errors returned by perk RPCs (perk not found / slug
 * conflicts) plus the catch-all service error. Class names and `_tag`
 * values are namespaced with `Rpc` / `Rpc/`.
 */
import * as Schema from "effect/Schema";

/** Perk row not found in the database. */
export class RpcPerkNotFoundError extends Schema.TaggedErrorClass<RpcPerkNotFoundError>(
  "RpcPerkNotFoundError",
)("Rpc/PerkNotFoundError", { message: Schema.String }) {}

/** Perk slug uniqueness invariant violated within a project. */
export class RpcPerkSlugAlreadyExistsError extends Schema.TaggedErrorClass<RpcPerkSlugAlreadyExistsError>(
  "RpcPerkSlugAlreadyExistsError",
)("Rpc/PerkSlugAlreadyExistsError", { slug: Schema.String }) {}

/**
 * Catch-all perk service error. Wraps `DatabaseError` (and other
 * infrastructural failures) at the public-method boundary so callers see
 * one stable error tag.
 */
export class RpcPerkServiceError extends Schema.TaggedErrorClass<RpcPerkServiceError>(
  "RpcPerkServiceError",
)("Rpc/PerkServiceError", { cause: Schema.String }) {}
