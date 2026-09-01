/**
 * Cross-cutting errors only — auth and framework-level failures that any
 * RPC can raise. These travel over the wire as part of the public RPC
 * contract.
 *
 * Class names and `_tag` values are namespaced with `Rpc` / `Rpc/` so they
 * cannot collide with errors defined elsewhere in the monorepo.
 */
import * as Schema from "effect/Schema";

/** Action is forbidden due to insufficient permissions */
export class RpcActionForbiddenError extends Schema.TaggedErrorClass<RpcActionForbiddenError>(
  "RpcActionForbiddenError",
)("Rpc/ActionForbiddenError", { message: Schema.String }) {}

/** Authentication failed */
export class RpcAuthenticationError extends Schema.TaggedErrorClass<RpcAuthenticationError>(
  "RpcAuthenticationError",
)("Rpc/AuthenticationError", { cause: Schema.String, message: Schema.String }) {}

/** User is not authenticated */
export class RpcNotAuthenticatedError extends Schema.TaggedErrorClass<RpcNotAuthenticatedError>(
  "RpcNotAuthenticatedError",
)("Rpc/NotAuthenticatedError", { message: Schema.String }) {}

/** Uploaded avatar failed validation (unsupported type, too large, or malformed). */
export class RpcAvatarValidationError extends Schema.TaggedErrorClass<RpcAvatarValidationError>(
  "RpcAvatarValidationError",
)("Rpc/AvatarValidationError", { message: Schema.String }) {}
