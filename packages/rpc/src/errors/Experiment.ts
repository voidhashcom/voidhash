/**
 * Experiment (A/B testing) errors — typed errors returned by experiment RPCs
 * (experiment / variant / treatment not found, domain-invariant violations)
 * plus the catch-all service error. Class names and `_tag` values are
 * namespaced with `Rpc` / `Rpc/`.
 */
import * as Schema from "effect/Schema";

/** Experiment row not found. */
export class RpcExperimentNotFoundError extends Schema.TaggedErrorClass<RpcExperimentNotFoundError>(
  "RpcExperimentNotFoundError",
)("Rpc/ExperimentNotFoundError", { message: Schema.String }) {}

/** Experiment variant row not found. */
export class RpcExperimentVariantNotFoundError extends Schema.TaggedErrorClass<RpcExperimentVariantNotFoundError>(
  "RpcExperimentVariantNotFoundError",
)("Rpc/ExperimentVariantNotFoundError", { message: Schema.String }) {}

/** A domain invariant was violated (weights, locked running experiment, target conflict, …). */
export class RpcExperimentValidationError extends Schema.TaggedErrorClass<RpcExperimentValidationError>(
  "RpcExperimentValidationError",
)("Rpc/ExperimentValidationError", { message: Schema.String }) {}

/**
 * Catch-all experiment service error. Wraps infrastructural failures (DB,
 * backing-flag sync) at the public-method boundary so callers see one stable
 * error tag.
 */
export class RpcExperimentServiceError extends Schema.TaggedErrorClass<RpcExperimentServiceError>(
  "RpcExperimentServiceError",
)("Rpc/ExperimentServiceError", { cause: Schema.String }) {}
