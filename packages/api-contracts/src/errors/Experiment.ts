import * as Schema from "effect/Schema";

/** Generic experiment service error */
export class ApiExperimentServiceError extends Schema.TaggedErrorClass<ApiExperimentServiceError>()(
  "Api/ExperimentServiceError",
  {
    cause: Schema.String,
  },
  { httpApiStatus: 500 },
) {}

/** Experiment not found */
export class ApiExperimentNotFoundError extends Schema.TaggedErrorClass<ApiExperimentNotFoundError>()(
  "Api/ExperimentNotFoundError",
  {
    experimentId: Schema.String,
  },
  { httpApiStatus: 404 },
) {}

/** Experiment variant not found */
export class ApiExperimentVariantNotFoundError extends Schema.TaggedErrorClass<ApiExperimentVariantNotFoundError>()(
  "Api/ExperimentVariantNotFoundError",
  {
    variantId: Schema.String,
  },
  { httpApiStatus: 404 },
) {}

/** The submitted setup is malformed — bad variant weights, no control, duplicate placements */
export class ApiExperimentValidationError extends Schema.TaggedErrorClass<ApiExperimentValidationError>()(
  "Api/ExperimentValidationError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 400 },
) {}

/**
 * The request is well-formed but the experiment's current state forbids it —
 * starting a concluded test, pausing one that is not running, or editing the
 * variant matrix of a running one. Distinct from
 * {@link ApiExperimentValidationError} so a caller can tell "fix your payload"
 * from "the resource moved on".
 */
export class ApiExperimentConflictError extends Schema.TaggedErrorClass<ApiExperimentConflictError>()(
  "Api/ExperimentConflictError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 409 },
) {}
