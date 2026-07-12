/**
 * Person errors — typed errors returned by person RPCs (person not found /
 * invalid anonymous id) plus the catch-all service error. Class names and
 * `_tag` values are namespaced with `Rpc` / `Rpc/`.
 */
import { Schema } from "effect";

/** Person not found in the database. */
export class RpcPersonNotFoundError extends Schema.TaggedErrorClass<RpcPersonNotFoundError>(
  "RpcPersonNotFoundError",
)("Rpc/PersonNotFoundError", { id: Schema.String }) {}

/** Anonymous ID is invalid. */
export class RpcPersonInvalidAnonymousIdError extends Schema.TaggedErrorClass<RpcPersonInvalidAnonymousIdError>(
  "RpcPersonInvalidAnonymousIdError",
)("Rpc/PersonInvalidAnonymousIdError", { id: Schema.String }) {}

/**
 * Catch-all person service error. Wraps `DatabaseError` (and any other
 * infrastructural failure) at the public-method boundary so callers see one
 * stable error tag.
 */
export class RpcPersonServiceError extends Schema.TaggedErrorClass<RpcPersonServiceError>(
  "RpcPersonServiceError",
)("Rpc/PersonServiceError", { cause: Schema.String }) {}
