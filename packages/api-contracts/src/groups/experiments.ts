import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi";

import { ApiActionForbiddenError } from "../errors/index.ts";
// Imported from the module rather than the barrel until `errors/index.ts`
// re-exports it.
import {
  ApiExperimentConflictError,
  ApiExperimentNotFoundError,
  ApiExperimentServiceError,
  ApiExperimentValidationError,
  ApiExperimentVariantNotFoundError,
} from "../errors/Experiment.ts";
import { AuthMiddleware } from "../Middlewares.ts";
import { paginated } from "../Pagination.ts";
import {
  ConcludeExperimentBody,
  CreateExperimentBody,
  Experiment,
  ExperimentListItem,
  ExperimentResults,
  ExperimentResultsParams,
  ListExperimentsParams,
  UpdateExperimentBody,
} from "../schemas/experiments.ts";

export const ExperimentsGroup = HttpApiGroup.make("experiments")
  /**
   * Lists a project's experiments, optionally narrowed to a single lifecycle
   * state. Archived tests are excluded unless `includeArchived=true`.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.get("listExperiments", "/", {
      query: ListExperimentsParams,
      success: paginated(ExperimentListItem),
      error: [ApiActionForbiddenError, ApiExperimentServiceError],
    }),
  )
  /**
   * Creates a draft experiment with a seeded 50/50 control + treatment pair
   * and a backing feature flag. The matrix and metrics are authored with a
   * follow-up `PATCH`.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.post("createExperiment", "/", {
      payload: CreateExperimentBody,
      success: Experiment.pipe(HttpApiSchema.status(201)),
      error: [ApiActionForbiddenError, ApiExperimentServiceError],
    }),
  )
  /**
   * Reads a single experiment with its variants, placements and backing flag.
   * The project is derived from the row, so no `projectId` is needed.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.get("getExperiment", "/:experimentId", {
      params: { experimentId: Schema.String },
      success: Experiment,
      error: [ApiActionForbiddenError, ApiExperimentNotFoundError, ApiExperimentServiceError],
    }),
  )
  /**
   * Applies the staged setup edits in one write: scalars, the metric
   * definition and — when `variants` is supplied — the whole variant matrix,
   * so a half-edited matrix can never be persisted. Editing metrics outside
   * `draft`, or the matrix while the test runs, is a `409`.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.patch("updateExperiment", "/:experimentId", {
      params: { experimentId: Schema.String },
      payload: UpdateExperimentBody,
      success: Experiment,
      error: [
        ApiActionForbiddenError,
        ApiExperimentConflictError,
        ApiExperimentNotFoundError,
        ApiExperimentServiceError,
        ApiExperimentValidationError,
        ApiExperimentVariantNotFoundError,
      ],
    }),
  )
  /**
   * Archives an experiment and disables its backing flag, so nothing keeps
   * assigning traffic. Reversible with `POST /experiments/:experimentId/restore`.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.delete("archiveExperiment", "/:experimentId", {
      params: { experimentId: Schema.String },
      error: [ApiActionForbiddenError, ApiExperimentNotFoundError, ApiExperimentServiceError],
    }),
  )
  /**
   * Restores an archived experiment. The backing flag stays disabled — a
   * restored test is not automatically running again.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.post("restoreExperiment", "/:experimentId/restore", {
      params: { experimentId: Schema.String },
      success: Experiment,
      error: [ApiActionForbiddenError, ApiExperimentNotFoundError, ApiExperimentServiceError],
    }),
  )
  /**
   * Starts assigning traffic: every targeted location switches to the
   * experiment's backing flag. Refuses with `409` when the test is concluded,
   * the weights are invalid, or a placed paywall has no active published
   * release (its cell would serve nothing).
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.post("startExperiment", "/:experimentId/start", {
      params: { experimentId: Schema.String },
      success: Experiment,
      error: [
        ApiActionForbiddenError,
        ApiExperimentConflictError,
        ApiExperimentNotFoundError,
        ApiExperimentServiceError,
      ],
    }),
  )
  /**
   * Freezes assignment — every subject falls back to control at serve time.
   * Only a running experiment can be paused.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.post("pauseExperiment", "/:experimentId/pause", {
      params: { experimentId: Schema.String },
      success: Experiment,
      error: [
        ApiActionForbiddenError,
        ApiExperimentConflictError,
        ApiExperimentNotFoundError,
        ApiExperimentServiceError,
      ],
    }),
  )
  /**
   * Ends the test and promotes the winner (the control arm when none is
   * named) to a plain paywall showing at every targeted location, so no
   * location is left dangling. Irreversible.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.post("concludeExperiment", "/:experimentId/conclude", {
      params: { experimentId: Schema.String },
      payload: ConcludeExperimentBody,
      success: Experiment,
      error: [
        ApiActionForbiddenError,
        ApiExperimentConflictError,
        ApiExperimentNotFoundError,
        ApiExperimentServiceError,
        ApiExperimentVariantNotFoundError,
      ],
    }),
  )
  /**
   * Per-arm exposures, conversions and revenue over the look-back window.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.get("getExperimentResults", "/:experimentId/results", {
      params: { experimentId: Schema.String },
      query: ExperimentResultsParams,
      success: ExperimentResults,
      error: [ApiActionForbiddenError, ApiExperimentNotFoundError, ApiExperimentServiceError],
    }),
  )
  .middleware(AuthMiddleware)
  .prefix("/experiments");
