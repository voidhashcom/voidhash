/**
 * Feature-flag domain — typed errors that signal an invariant violation on a
 * feature flag, override, or target row. Row data lives in the `featureFlags`
 * Drizzle table.
 */
import * as Schema from "effect/Schema";

/** Feature-flag row not found. */
export class FeatureFlagNotFoundError extends Schema.TaggedErrorClass<FeatureFlagNotFoundError>(
  "FeatureFlagNotFoundError",
)("FeatureFlagNotFoundError", { featureFlagId: Schema.String }) {}

/** Feature-flag key uniqueness invariant violated within a project. */
export class FeatureFlagKeyAlreadyExistsError extends Schema.TaggedErrorClass<FeatureFlagKeyAlreadyExistsError>(
  "FeatureFlagKeyAlreadyExistsError",
)("FeatureFlagKeyAlreadyExistsError", { key: Schema.String }) {}

/** Feature-flag override row not found. */
export class FeatureFlagOverrideNotFoundError extends Schema.TaggedErrorClass<FeatureFlagOverrideNotFoundError>(
  "FeatureFlagOverrideNotFoundError",
)("FeatureFlagOverrideNotFoundError", { overrideId: Schema.String }) {}

/** Feature-flag target row not found. */
export class FeatureFlagTargetNotFoundError extends Schema.TaggedErrorClass<FeatureFlagTargetNotFoundError>(
  "FeatureFlagTargetNotFoundError",
)("FeatureFlagTargetNotFoundError", { targetId: Schema.String }) {}
