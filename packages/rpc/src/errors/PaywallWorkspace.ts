/**
 * Paywall workspace errors — typed errors returned by the workspace RPCs
 * (server-side paywall filesystem projection + component-manifest cache).
 * Class names and `_tag` values are namespaced with `Rpc` / `Rpc/`.
 */
import { Schema } from "effect";

/**
 * Catch-all workspace service error. Wraps DB, mimic-host, and manifest-cache
 * infrastructural failures at the boundary so callers see one stable tag.
 */
export class RpcPaywallWorkspaceError extends Schema.TaggedErrorClass<RpcPaywallWorkspaceError>(
  "RpcPaywallWorkspaceError",
)("Rpc/PaywallWorkspaceError", { message: Schema.String }) {}

/**
 * A recorded component manifest failed validation against the component-manifest
 * schema (a `ready` upload must carry a well-formed manifest).
 */
export class RpcComponentManifestInvalidError extends Schema.TaggedErrorClass<RpcComponentManifestInvalidError>(
  "RpcComponentManifestInvalidError",
)("Rpc/ComponentManifestInvalidError", { message: Schema.String }) {}
