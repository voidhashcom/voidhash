/**
 * Experiment (A/B testing) domain — typed errors that signal an invariant
 * violation on an experiment, variant, or treatment. Row data lives in the
 * `experiments` / `experiment_variant` / `experiment_treatment` Drizzle tables.
 * An experiment compiles down to a backing customer feature flag (the runtime
 * assignment artifact); see `ExperimentService`.
 */
import { Schema } from "effect";

/** Experiment row not found. */
export class ExperimentNotFoundError extends Schema.TaggedErrorClass<ExperimentNotFoundError>(
  "ExperimentNotFoundError",
)("ExperimentNotFoundError", { experimentId: Schema.String }) {}

/** Experiment variant row not found. */
export class ExperimentVariantNotFoundError extends Schema.TaggedErrorClass<ExperimentVariantNotFoundError>(
  "ExperimentVariantNotFoundError",
)("ExperimentVariantNotFoundError", { variantId: Schema.String }) {}

/** Experiment treatment row not found. */
export class ExperimentTreatmentNotFoundError extends Schema.TaggedErrorClass<ExperimentTreatmentNotFoundError>(
  "ExperimentTreatmentNotFoundError",
)("ExperimentTreatmentNotFoundError", { treatmentId: Schema.String }) {}

/**
 * A domain invariant was violated — bad variant weights, editing a locked
 * running experiment, a target-location conflict with another experiment, an
 * unknown treatment type, etc. Carries a human-readable message.
 */
export class ExperimentValidationError extends Schema.TaggedErrorClass<ExperimentValidationError>(
  "ExperimentValidationError",
)("ExperimentValidationError", { message: Schema.String }) {}
