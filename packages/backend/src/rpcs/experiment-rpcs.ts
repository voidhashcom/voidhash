import { AnalyticsService, ExperimentService } from "@voidhash/core/services";
import {
  ExperimentRpcsDef,
  RpcActionForbiddenError,
  RpcExperimentNotFoundError,
  RpcExperimentServiceError,
  RpcExperimentValidationError,
  RpcExperimentVariantNotFoundError,
} from "@voidhash/rpc";
import { Effect } from "effect";

interface BackingFeatureFlag {
  readonly id: string;
  readonly key: string;
  readonly enabled: boolean;
  readonly rolloutBps: number;
}

const toBackingFlag = (featureFlag: BackingFeatureFlag | null) => {
  if (featureFlag === null) return null;
  return {
    enabled: featureFlag.enabled,
    id: featureFlag.id,
    key: featureFlag.key,
    rolloutBps: featureFlag.rolloutBps,
  };
};

/** Map the service's experiment-with-relations to the RPC wire shape. */
const toRpcExperiment = (e: {
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
  readonly featureFlag: {
    readonly id: string;
    readonly key: string;
    readonly enabled: boolean;
    readonly rolloutBps: number;
  } | null;
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
    const analyticsService = yield* AnalyticsService;

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
        analyticsService.getExperimentResults(input).pipe(
          Effect.catchTags({
            ActionForbiddenError: forbidden,
            AnalyticsServiceError: (error) =>
              Effect.fail(new RpcExperimentServiceError({ cause: error.cause })),
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
      SaveExperimentSetup: (input) =>
        service.saveSetup(input).pipe(
          Effect.map(toRpcExperiment),
          Effect.catchTags({
            ActionForbiddenError: forbidden,
            ExperimentNotFoundError: notFound,
            ExperimentServiceError: serviceError,
            ExperimentValidationError: validation,
            ExperimentVariantNotFoundError: variantNotFound,
          }),
        ),
    };
  }),
);
