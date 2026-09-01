import * as Schema from "effect/Schema";

/** Generic feature flag service error */
export class ApiFeatureFlagServiceError extends Schema.TaggedErrorClass<ApiFeatureFlagServiceError>()(
  "Api/FeatureFlagServiceError",
  {
    cause: Schema.String,
  },
  { httpApiStatus: 500 },
) {}

/** Feature flag not found */
export class ApiFeatureFlagNotFoundError extends Schema.TaggedErrorClass<ApiFeatureFlagNotFoundError>()(
  "Api/FeatureFlagNotFoundError",
  {
    featureFlagId: Schema.String,
  },
  { httpApiStatus: 404 },
) {}

/** Feature flag slug already taken within the project */
export class ApiFeatureFlagKeyAlreadyExistsError extends Schema.TaggedErrorClass<ApiFeatureFlagKeyAlreadyExistsError>()(
  "Api/FeatureFlagKeyAlreadyExistsError",
  {
    key: Schema.String,
  },
  { httpApiStatus: 409 },
) {}

/** Feature flag override not found */
export class ApiFeatureFlagOverrideNotFoundError extends Schema.TaggedErrorClass<ApiFeatureFlagOverrideNotFoundError>()(
  "Api/FeatureFlagOverrideNotFoundError",
  {
    overrideId: Schema.String,
  },
  { httpApiStatus: 404 },
) {}

/** Feature flag target not found */
export class ApiFeatureFlagTargetNotFoundError extends Schema.TaggedErrorClass<ApiFeatureFlagTargetNotFoundError>()(
  "Api/FeatureFlagTargetNotFoundError",
  {
    targetId: Schema.String,
  },
  { httpApiStatus: 404 },
) {}
