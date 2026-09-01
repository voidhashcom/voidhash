/**
 * Paywall asset errors — typed errors returned by paywall-asset RPCs. Class
 * names and `_tag` values are namespaced with `Rpc` / `Rpc/`.
 */
import * as Schema from "effect/Schema";

/** Catch-all service failure (db / storage). */
export class RpcPaywallAssetServiceError extends Schema.TaggedErrorClass<RpcPaywallAssetServiceError>(
  "RpcPaywallAssetServiceError",
)("Rpc/PaywallAssetServiceError", { message: Schema.String }) {}

/** Referenced asset row not found. */
export class RpcPaywallAssetNotFoundError extends Schema.TaggedErrorClass<RpcPaywallAssetNotFoundError>(
  "RpcPaywallAssetNotFoundError",
)("Rpc/PaywallAssetNotFoundError", { assetId: Schema.String }) {}

/** Uploaded image failed validation (unsupported type, too large, or malformed). */
export class RpcPaywallAssetValidationError extends Schema.TaggedErrorClass<RpcPaywallAssetValidationError>(
  "RpcPaywallAssetValidationError",
)("Rpc/PaywallAssetValidationError", { message: Schema.String }) {}
