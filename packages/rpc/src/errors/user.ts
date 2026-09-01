/**
 * User errors — typed errors returned by user RPCs. Class names and `_tag`
 * values are namespaced with `Rpc` / `Rpc/`.
 */
import * as Schema from "effect/Schema";

/**
 * Catch-all user service error. Wraps any non-typed infrastructural failure
 * at the public-method boundary so callers see one stable error tag.
 */
export class RpcUserServiceError extends Schema.TaggedErrorClass<RpcUserServiceError>(
  "RpcUserServiceError",
)("Rpc/UserServiceError", { cause: Schema.String }) {}
