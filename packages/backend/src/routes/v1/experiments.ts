import {
  createdResponse,
  Experiment,
  ExperimentBackingFlag,
  ExperimentListItem,
  ExperimentResults,
  ExperimentTreatment,
  ExperimentVariant,
  ExperimentVariantResult,
  VoidhashV1Api,
} from "@voidhash/api-contracts";
import {
  ApiActionForbiddenError,
  ApiExperimentConflictError,
  ApiExperimentNotFoundError,
  ApiExperimentServiceError,
  ApiExperimentValidationError,
  ApiExperimentVariantNotFoundError,
} from "@voidhash/api-contracts/errors";
import { ExperimentService } from "@voidhash/core/services";
import { AnalyticsQuery } from "@voidhash/core-v2";
import { paginate, resolveRequestProjectId, sortById } from "@voidhash/core/utils";
import { ExperimentStatus } from "@voidhash/db";
import { AuthSession } from "@voidhash/rpc";
import { DateTime, Duration, Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { bridgeAuthSession, requireCredential } from "../../ApiMiddlewares.ts";

type ExperimentStatusName = "draft" | "running" | "paused" | "concluded";

/** The lifecycle small-int column is published under its name, and filtered on by name. */
const STATUS_NAMES = new Map<number, ExperimentStatusName>([
  [ExperimentStatus.draft, "draft"],
  [ExperimentStatus.running, "running"],
  [ExperimentStatus.paused, "paused"],
  [ExperimentStatus.concluded, "concluded"],
]);

const STATUS_CODES: Record<ExperimentStatusName, number> = {
  concluded: ExperimentStatus.concluded,
  draft: ExperimentStatus.draft,
  paused: ExperimentStatus.paused,
  running: ExperimentStatus.running,
};

const toStatusName = (status: number): ExperimentStatusName => STATUS_NAMES.get(status) ?? "draft";

/**
 * The service surfaces one validation tag for two very different situations:
 * a malformed setup (fixable by the caller) and an edit the experiment's
 * current state forbids. These are the messages that mean the latter, so
 * `PATCH` can answer `409` for them and `400` for everything else. The
 * lifecycle transitions do not need the split — every rejection there is a
 * state conflict.
 */
const STATE_CONFLICT_MESSAGES = [
  "Metrics can only be changed while the A/B test is a draft",
  "Variants and placements are locked while the A/B test is running",
];

const isStateConflict = (message: string) => STATE_CONFLICT_MESSAGES.includes(message);

interface ExperimentRelations {
  readonly archivedAt: Date | null;
  readonly createdAt: Date | null;
  readonly createdByUserId: string | null;
  readonly description: string | null;
  readonly endedAt: Date | null;
  readonly featureFlagId: string;
  readonly hypothesis: string | null;
  readonly id: string;
  readonly name: string;
  readonly primaryMetricEventName: string | null;
  readonly projectId: string;
  readonly secondaryMetricEventNames: readonly string[] | null;
  readonly startedAt: Date | null;
  readonly status: number;
  readonly updatedAt: Date | null;
  readonly updatedByUserId: string | null;
  readonly version: number;
  readonly winningVariantId: string | null;
  readonly featureFlag: {
    readonly enabled: boolean;
    readonly id: string;
    readonly key: string;
    readonly rolloutBps: number;
  } | null;
  readonly treatments: ReadonlyArray<{
    readonly archivedAt: Date | null;
    readonly config: unknown;
    readonly createdAt: Date | null;
    readonly experimentId: string;
    readonly id: string;
    readonly treatmentType: string;
    readonly updatedAt: Date | null;
    readonly variantId: string;
  }>;
  readonly variants: ReadonlyArray<{
    readonly archivedAt: Date | null;
    readonly createdAt: Date | null;
    readonly experimentId: string;
    readonly id: string;
    readonly isControl: boolean;
    readonly name: string;
    readonly updatedAt: Date | null;
    readonly weightBps: number;
  }>;
}

const toBackingFlag = (featureFlag: ExperimentRelations["featureFlag"]) => {
  if (featureFlag === null) {
    return null;
  }
  return new ExperimentBackingFlag({
    enabled: featureFlag.enabled,
    id: featureFlag.id,
    key: featureFlag.key,
    rolloutBps: featureFlag.rolloutBps,
  });
};

/** Map the service's experiment-with-relations onto the wire shape. */
const toExperiment = (experiment: ExperimentRelations) =>
  new Experiment({
    archivedAt: experiment.archivedAt,
    backingFlag: toBackingFlag(experiment.featureFlag),
    createdAt: experiment.createdAt,
    createdByUserId: experiment.createdByUserId,
    description: experiment.description,
    endedAt: experiment.endedAt,
    featureFlagId: experiment.featureFlagId,
    hypothesis: experiment.hypothesis,
    id: experiment.id,
    name: experiment.name,
    primaryMetricEventName: experiment.primaryMetricEventName,
    projectId: experiment.projectId,
    secondaryMetricEventNames: experiment.secondaryMetricEventNames,
    startedAt: experiment.startedAt,
    status: toStatusName(experiment.status),
    treatments: experiment.treatments.map((treatment) => new ExperimentTreatment(treatment)),
    updatedAt: experiment.updatedAt,
    updatedByUserId: experiment.updatedByUserId,
    variants: experiment.variants.map((variant) => new ExperimentVariant(variant)),
    version: experiment.version,
    winningVariantId: experiment.winningVariantId,
  });

const toListItem = (
  experiment: Omit<ExperimentRelations, "featureFlag" | "treatments" | "variants"> & {
    readonly paywallLocationIds: ReadonlyArray<string>;
    readonly variantCount: number;
  },
) =>
  new ExperimentListItem({
    archivedAt: experiment.archivedAt,
    createdAt: experiment.createdAt,
    createdByUserId: experiment.createdByUserId,
    description: experiment.description,
    endedAt: experiment.endedAt,
    featureFlagId: experiment.featureFlagId,
    hypothesis: experiment.hypothesis,
    id: experiment.id,
    name: experiment.name,
    paywallLocationIds: experiment.paywallLocationIds,
    primaryMetricEventName: experiment.primaryMetricEventName,
    projectId: experiment.projectId,
    secondaryMetricEventNames: experiment.secondaryMetricEventNames,
    startedAt: experiment.startedAt,
    status: toStatusName(experiment.status),
    updatedAt: experiment.updatedAt,
    updatedByUserId: experiment.updatedByUserId,
    variantCount: experiment.variantCount,
    version: experiment.version,
    winningVariantId: experiment.winningVariantId,
  });

const forbidden = (error: { readonly message: string }) =>
  Effect.fail(new ApiActionForbiddenError({ message: error.message }));
const serviceError = (error: { readonly cause: string }) =>
  Effect.fail(new ApiExperimentServiceError({ cause: error.cause }));
const notFound = (error: { readonly experimentId: string }) =>
  Effect.fail(new ApiExperimentNotFoundError({ experimentId: error.experimentId }));
const variantNotFound = (error: { readonly variantId: string }) =>
  Effect.fail(new ApiExperimentVariantNotFoundError({ variantId: error.variantId }));
const conflict = (error: { readonly message: string }) =>
  Effect.fail(new ApiExperimentConflictError({ message: error.message }));

/** A setup edit the current state forbids is a conflict; anything else is a validation failure. */
const setupValidationFailure = (error: { readonly message: string }) => {
  if (isStateConflict(error.message)) {
    return conflict(error);
  }
  return Effect.fail(new ApiExperimentValidationError({ message: error.message }));
};

/**
 * The analytics read folds a missing experiment into its own service error;
 * recover the 404 from the message it sets.
 */
const resultsAnalyticsFailure = (error: { readonly cause: string; readonly message: string }) => {
  if (error.message === "Experiment not found") {
    return Effect.fail(new ApiExperimentNotFoundError({ experimentId: error.cause }));
  }
  return Effect.fail(new ApiExperimentServiceError({ cause: error.cause }));
};

export const ExperimentsGroupLive = HttpApiBuilder.group(VoidhashV1Api, "experiments", (handlers) =>
  Effect.gen(function* () {
    const analytics = yield* AnalyticsQuery;
    const experimentService = yield* ExperimentService;

    /**
     * Lifecycle transitions return void, so the response body is re-read
     * afterwards. The read repeats the permission check, which is cheap and
     * keeps every write on the same authorization path.
     */
    const reload = (experimentId: string) =>
      experimentService.getExperiment({ id: experimentId }).pipe(Effect.map(toExperiment));

    return handlers
      .handle("listExperiments", ({ query }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, ["user", "secret-key"]);
            const projectId = yield* resolveRequestProjectId(authSession, query.projectId);
            const experiments = yield* experimentService.listExperiments({
              includeArchived: query.includeArchived === "true",
              projectId,
            });
            const status = query.status;
            const matching = experiments.filter(
              (experiment) => status === undefined || experiment.status === STATUS_CODES[status],
            );
            const ordered = sortById(matching, (experiment) => experiment.id);
            const page = yield* paginate(ordered, (experiment) => experiment.id, query);
            return {
              data: page.data.map(toListItem),
              pageInfo: page.pageInfo,
            };
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: forbidden,
            ExperimentServiceError: serviceError,
          }),
        ),
      )
      .handle("createExperiment", ({ payload }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, ["user", "secret-key"]);
            const projectId = yield* resolveRequestProjectId(authSession, payload.projectId);
            const created = yield* experimentService.createExperiment({
              name: payload.name,
              projectId,
            });
            const experiment = yield* reload(created.id);
            return yield* createdResponse(Experiment, experiment, `/experiments/${experiment.id}`);
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: forbidden,
            // The row was just written; not finding it is an internal fault,
            // not a 404 the caller can act on.
            ExperimentNotFoundError: (e) =>
              Effect.fail(
                new ApiExperimentServiceError({
                  cause: `Experiment ${e.experimentId} disappeared after creation`,
                }),
              ),
            ExperimentServiceError: serviceError,
          }),
        ),
      )
      .handle("getExperiment", ({ params }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, ["user", "secret-key"]);
            return yield* reload(params.experimentId);
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: forbidden,
            ExperimentNotFoundError: notFound,
            ExperimentServiceError: serviceError,
          }),
        ),
      )
      .handle("updateExperiment", ({ params, payload }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, ["user", "secret-key"]);
            const experiment = yield* experimentService.saveSetup({
              ...payload,
              id: params.experimentId,
            });
            return toExperiment(experiment);
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: forbidden,
            ExperimentNotFoundError: notFound,
            ExperimentServiceError: serviceError,
            ExperimentValidationError: setupValidationFailure,
            ExperimentVariantNotFoundError: variantNotFound,
          }),
        ),
      )
      .handle("archiveExperiment", ({ params }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, ["user", "secret-key"]);
            return yield* experimentService.archiveExperiment({ id: params.experimentId });
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: forbidden,
            ExperimentNotFoundError: notFound,
            ExperimentServiceError: serviceError,
          }),
        ),
      )
      .handle("restoreExperiment", ({ params }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, ["user", "secret-key"]);
            yield* experimentService.restoreExperiment({ id: params.experimentId });
            return yield* reload(params.experimentId);
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: forbidden,
            ExperimentNotFoundError: notFound,
            ExperimentServiceError: serviceError,
          }),
        ),
      )
      .handle("startExperiment", ({ params }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, ["user", "secret-key"]);
            yield* experimentService.startExperiment({ id: params.experimentId });
            return yield* reload(params.experimentId);
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: forbidden,
            ExperimentNotFoundError: notFound,
            ExperimentServiceError: serviceError,
            // Every rejection a transition can raise is a state conflict:
            // a concluded test, an unpublished paywall in the matrix, or
            // weights that do not add up.
            ExperimentValidationError: conflict,
          }),
        ),
      )
      .handle("pauseExperiment", ({ params }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, ["user", "secret-key"]);
            yield* experimentService.pauseExperiment({ id: params.experimentId });
            return yield* reload(params.experimentId);
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: forbidden,
            ExperimentNotFoundError: notFound,
            ExperimentServiceError: serviceError,
            ExperimentValidationError: conflict,
          }),
        ),
      )
      .handle("concludeExperiment", ({ params, payload }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, ["user", "secret-key"]);
            yield* experimentService.concludeExperiment({
              id: params.experimentId,
              winningVariantId: payload.winningVariantId,
            });
            return yield* reload(params.experimentId);
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: forbidden,
            ExperimentNotFoundError: notFound,
            ExperimentServiceError: serviceError,
            ExperimentVariantNotFoundError: variantNotFound,
          }),
        ),
      )
      .handle("getExperimentResults", ({ params, query }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, ["user", "secret-key"]);
            const experiment = yield* experimentService.getExperiment({
              id: params.experimentId,
            });
            const now = yield* DateTime.now;
            const results = yield* analytics.getExperimentResults({
              end: experiment.endedAt ?? DateTime.toDateUtc(now),
              experimentId: experiment.id,
              primaryMetricEventName: experiment.primaryMetricEventName ?? "purchase_completed",
              projectId: experiment.projectId,
              start:
                experiment.startedAt ??
                DateTime.toDateUtc(DateTime.subtractDuration(now, Duration.days(query.days ?? 90))),
            });
            return new ExperimentResults({
              variants: results.variants.map((variant) => new ExperimentVariantResult(variant)),
            });
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: forbidden,
            AnalyticsQueryError: resultsAnalyticsFailure,
            ExperimentNotFoundError: notFound,
            ExperimentServiceError: serviceError,
          }),
        ),
      );
  }),
);
