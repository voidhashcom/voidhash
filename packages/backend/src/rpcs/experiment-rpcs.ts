import * as Schema from "effect/Schema";
import { ExperimentService } from "@voidhash/core/services";
import { AnalyticsQuery } from "@voidhash/core-v2";
import {
  ExperimentRpcsDef,
  RpcActionForbiddenError,
  RpcExperimentNotFoundError,
  RpcExperimentServiceError,
  RpcExperimentValidationError,
  RpcExperimentVariantNotFoundError,
} from "@voidhash/rpc";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

interface BackingFeatureFlag {
  readonly id: string;
  readonly key: string;
  readonly enabled: boolean;
  readonly rolloutBps: number;
}

const toBackingFlag = (featureFlag: BackingFeatureFlag | typeof Schema.Null.Type) => {
  if (featureFlag === null) return null;
  return {
    id: featureFlag.id,
    isEnabled: featureFlag.enabled,
    key: featureFlag.key,
    rolloutBps: featureFlag.rolloutBps,
  };
};

/** Map the service's experiment-with-relations to the RPC wire shape. */
const toRpcExperiment = (e: {
  readonly archivedAt: Date | typeof Schema.Null.Type;
  readonly createdAt: Date | typeof Schema.Null.Type;
  readonly createdByUserId: string | typeof Schema.Null.Type;
  readonly description: string | typeof Schema.Null.Type;
  readonly endedAt: Date | typeof Schema.Null.Type;
  readonly featureFlagId: string;
  readonly hypothesis: string | typeof Schema.Null.Type;
  readonly id: string;
  readonly name: string;
  readonly primaryMetricEventName: string | typeof Schema.Null.Type;
  readonly projectId: string;
  readonly secondaryMetricEventNames: readonly string[] | typeof Schema.Null.Type;
  readonly startedAt: Date | typeof Schema.Null.Type;
  readonly status: number;
  readonly updatedAt: Date | typeof Schema.Null.Type;
  readonly updatedByUserId: string | typeof Schema.Null.Type;
  readonly version: number;
  readonly winningVariantId: string | typeof Schema.Null.Type;
  readonly variants: ReadonlyArray<{
    readonly archivedAt: Date | typeof Schema.Null.Type;
    readonly createdAt: Date | typeof Schema.Null.Type;
    readonly experimentId: string;
    readonly id: string;
    readonly isControl: boolean;
    readonly name: string;
    readonly updatedAt: Date | typeof Schema.Null.Type;
    readonly weightBps: number;
  }>;
  readonly treatments: ReadonlyArray<{
    readonly archivedAt: Date | typeof Schema.Null.Type;
    readonly config: unknown;
    readonly createdAt: Date | typeof Schema.Null.Type;
    readonly experimentId: string;
    readonly id: string;
    readonly treatmentType: string;
    readonly updatedAt: Date | typeof Schema.Null.Type;
    readonly variantId: string;
  }>;
  readonly featureFlag:
    | {
        readonly id: string;
        readonly key: string;
        readonly enabled: boolean;
        readonly rolloutBps: number;
      }
    | typeof Schema.Null.Type;
}) => ({
  archivedAt: e.archivedAt,
  backingFlag: toBackingFlag(e.featureFlag),
  createdAt: e.createdAt,
  createdByUserId: e.createdByUserId,
  description: e.description,
  endedAt: e.endedAt,
  featureFlagId: e.featureFlagId,
  hypothesis: e.hypothesis,
  id: e.id,
  name: e.name,
  primaryMetricEventName: e.primaryMetricEventName,
  projectId: e.projectId,
  secondaryMetricEventNames: e.secondaryMetricEventNames,
  startedAt: e.startedAt,
  status: e.status,
  treatments: e.treatments,
  updatedAt: e.updatedAt,
  updatedByUserId: e.updatedByUserId,
  variants: e.variants,
  version: e.version,
  winningVariantId: e.winningVariantId,
});

export const ExperimentRpcsLive = ExperimentRpcsDef.toLayer(
  Effect.gen(function* ExperimentRpcsLive() {
    const service = yield* ExperimentService;
    const analytics = yield* AnalyticsQuery;

    // Shared error mappers keep every handler's catchTags terse.
    const serviceError = (error: { readonly cause: string }) =>
      Effect.fail(new RpcExperimentServiceError({ cause: error.cause }));
    const forbidden = (error: { readonly message: string }) =>
      Effect.fail(new RpcActionForbiddenError({ message: error.message }));
    const notFound = (error: { readonly experimentId: string }) =>
      Effect.fail(
        new RpcExperimentNotFoundError({ message: `Experiment not found: ${error.experimentId}` }),
      );
    const validation = (error: { readonly message: string }) =>
      Effect.fail(new RpcExperimentValidationError({ message: error.message }));
    const variantNotFound = (error: { readonly variantId: string }) =>
      Effect.fail(
        new RpcExperimentVariantNotFoundError({ message: `Variant not found: ${error.variantId}` }),
      );

    return {
      ArchiveExperiment: (input) =>
        service.archiveExperiment(input).pipe(
          Effect.catchTags({
            ActionForbiddenError: forbidden,
            ExperimentNotFoundError: notFound,
            ExperimentServiceError: serviceError,
          }),
        ),
      ConcludeExperiment: (input) =>
        service.concludeExperiment(input).pipe(
          Effect.catchTags({
            ActionForbiddenError: forbidden,
            ExperimentNotFoundError: notFound,
            ExperimentServiceError: serviceError,
            ExperimentVariantNotFoundError: variantNotFound,
          }),
        ),
      CreateExperiment: (input) =>
        service.createExperiment(input).pipe(
          Effect.catchTags({
            ActionForbiddenError: forbidden,
            ExperimentServiceError: serviceError,
          }),
        ),
      GetExperiment: (input) =>
        service.getExperiment(input).pipe(
          Effect.map(toRpcExperiment),
          Effect.catchTags({
            ActionForbiddenError: forbidden,
            ExperimentNotFoundError: notFound,
            ExperimentServiceError: serviceError,
          }),
        ),
      GetExperimentResults: (input) =>
        Effect.fn("GetExperimentResults")(function* () {
          const experiment = yield* service.getExperiment({ id: input.experimentId });
          const now = yield* DateTime.now;
          return yield* analytics.getExperimentResults({
            end: experiment.endedAt ?? DateTime.toDateUtc(now),
            experimentId: experiment.id,
            primaryMetricEventName: experiment.primaryMetricEventName ?? "purchase_completed",
            projectId: experiment.projectId,
            start:
              experiment.startedAt ??
              DateTime.toDateUtc(DateTime.subtractDuration(now, Duration.days(input.days ?? 90))),
          });
        })().pipe(
          Effect.catchTags({
            ActionForbiddenError: forbidden,
            AnalyticsAuthorizationDeniedError: forbidden,
            AnalyticsQueryError: (error) =>
              Effect.fail(new RpcExperimentServiceError({ cause: error.cause })),
            ExperimentNotFoundError: (error) =>
              Effect.fail(new RpcExperimentServiceError({ cause: error.experimentId })),
            ExperimentServiceError: serviceError,
          }),
        ),
      ListExperiments: (input) =>
        service.listExperiments(input).pipe(
          Effect.catchTags({
            ActionForbiddenError: forbidden,
            ExperimentServiceError: serviceError,
          }),
        ),
      PauseExperiment: (input) =>
        service.pauseExperiment(input).pipe(
          Effect.catchTags({
            ActionForbiddenError: forbidden,
            ExperimentNotFoundError: notFound,
            ExperimentServiceError: serviceError,
            ExperimentValidationError: validation,
          }),
        ),
      RestoreExperiment: (input) =>
        service.restoreExperiment(input).pipe(
          Effect.catchTags({
            ActionForbiddenError: forbidden,
            ExperimentNotFoundError: notFound,
            ExperimentServiceError: serviceError,
          }),
        ),
      StartExperiment: (input) =>
        service.startExperiment(input).pipe(
          Effect.catchTags({
            ActionForbiddenError: forbidden,
            ExperimentNotFoundError: notFound,
            ExperimentServiceError: serviceError,
            ExperimentValidationError: validation,
          }),
        ),
      SaveExperimentSetup: (input) => {
        const {
          description,
          hypothesis,
          primaryMetricEventName,
          secondaryMetricEventNames,
          ...setup
        } = input;
        return service
          .saveSetup({
            ...setup,
            ...(description === undefined
              ? {}
              : { description: Option.fromNullishOr(description) }),
            ...(hypothesis === undefined ? {} : { hypothesis: Option.fromNullishOr(hypothesis) }),
            ...(primaryMetricEventName === undefined
              ? {}
              : { primaryMetricEventName: Option.fromNullishOr(primaryMetricEventName) }),
            ...(secondaryMetricEventNames === undefined
              ? {}
              : { secondaryMetricEventNames: Option.fromNullishOr(secondaryMetricEventNames) }),
          })
          .pipe(
            Effect.map(toRpcExperiment),
            Effect.catchTags({
              ActionForbiddenError: forbidden,
              ExperimentNotFoundError: notFound,
              ExperimentServiceError: serviceError,
              ExperimentValidationError: validation,
              ExperimentVariantNotFoundError: variantNotFound,
            }),
          );
      },
    };
  }),
);
