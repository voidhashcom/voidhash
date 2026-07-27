/**
 * Project errors — typed errors returned by project RPCs. Class names and
 * `_tag` values are namespaced with `Rpc` / `Rpc/`.
 */
import { Schema } from "effect";

/** Project row not found in the database. */
export class RpcProjectNotFoundError extends Schema.TaggedErrorClass<RpcProjectNotFoundError>(
  "RpcProjectNotFoundError",
)("Rpc/ProjectNotFoundError", { projectId: Schema.String }) {}

/**
 * Catch-all project service error. Wraps `DatabaseError` (and other
 * infrastructural failures) at the public-method boundary so callers see
 * one stable error tag.
 */
export class RpcProjectServiceError extends Schema.TaggedErrorClass<RpcProjectServiceError>(
  "RpcProjectServiceError",
)("Rpc/ProjectServiceError", { cause: Schema.String }) {}
