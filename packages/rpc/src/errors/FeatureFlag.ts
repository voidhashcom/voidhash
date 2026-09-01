/**
 * Feature-flag errors — typed errors returned by feature-flag RPCs (flag,
 * override, target not found / key conflicts) plus the catch-all service
 * error. Class names and `_tag` values are namespaced with `Rpc` / `Rpc/`.
 */
import * as Schema from "effect/Schema";

/** Feature-flag row not found. */
export class RpcFeatureFlagNotFoundError extends Schema.TaggedErrorClass<RpcFeatureFlagNotFoundError>(
  "RpcFeatureFlagNotFoundError",
)("Rpc/FeatureFlagNotFoundError", { message: Schema.String }) {}

/** Feature-flag key uniqueness invariant violated within a project. */
export class RpcFeatureFlagKeyAlreadyExistsError extends Schema.TaggedErrorClass<RpcFeatureFlagKeyAlreadyExistsError>(
  "RpcFeatureFlagKeyAlreadyExistsError",
)("Rpc/FeatureFlagKeyAlreadyExistsError", { key: Schema.String }) {}

/** Feature-flag override row not found. */
export class RpcFeatureFlagOverrideNotFoundError extends Schema.TaggedErrorClass<RpcFeatureFlagOverrideNotFoundError>(
  "RpcFeatureFlagOverrideNotFoundError",
)("Rpc/FeatureFlagOverrideNotFoundError", { message: Schema.String }) {}

/** Feature-flag target row not found. */
export class RpcFeatureFlagTargetNotFoundError extends Schema.TaggedErrorClass<RpcFeatureFlagTargetNotFoundError>(
  "RpcFeatureFlagTargetNotFoundError",
)("Rpc/FeatureFlagTargetNotFoundError", { message: Schema.String }) {}

/**
 * Catch-all feature-flag service error. Wraps `DatabaseError` and other
 * infrastructural failures at the public-method boundary so callers see one
 * stable error tag.
 */
export class RpcFeatureFlagServiceError extends Schema.TaggedErrorClass<RpcFeatureFlagServiceError>(
  "RpcFeatureFlagServiceError",
)("Rpc/FeatureFlagServiceError", { cause: Schema.String }) {}
