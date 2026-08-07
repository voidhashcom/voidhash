import { AnalyticsService, CustomAnalyticsService } from "@voidhash/core/services";
import {
  AnalyticsRpcsDef,
  RpcActionForbiddenError,
  RpcAnalyticsServiceError,
  RpcInvalidAnalyticsQueryError,
  RpcInvalidTimeRangeError,
  RpcUnknownInsightError,
  RpcUnsupportedAnalyticsBreakdownError,
  RpcUnsupportedAnalyticsFilterError,
} from "@voidhash/rpc";
import { Effect } from "effect";

/** Copies a readonly breakdown list into the mutable array the service expects. */
const toMutableBreakdowns = <T>(breakdowns: readonly T[] | undefined): T[] | undefined => {
  if (!breakdowns) return undefined;
  return [...breakdowns];
};

export const AnalyticsRpcsLive = AnalyticsRpcsDef.toLayer(
  Effect.gen(function* AnalyticsRpcsLive() {
    const analyticsService = yield* AnalyticsService;
    const customAnalyticsService = yield* CustomAnalyticsService;

    const commonErrors = {
      ActionForbiddenError: (error: { readonly message: string }) =>
        Effect.fail(new RpcActionForbiddenError({ message: error.message })),
      AnalyticsServiceError: (error: { readonly cause: string; readonly message: string }) =>
        Effect.fail(
          new RpcAnalyticsServiceError({
            cause: error.cause,
            message: error.message,
          }),
        ),
    };

    return {
      ListRecentAnalyticsEvents: ({ projectId, limit }) =>
        analyticsService
          .listRecentEvents({
            limit,
            projectId,
          })
          .pipe(
            Effect.catchTags({
              ActionForbiddenError: (error) =>
                Effect.fail(new RpcActionForbiddenError({ message: error.message })),
              AnalyticsServiceError: (error) =>
                Effect.fail(
                  new RpcAnalyticsServiceError({
                    cause: error.cause,
                    message: error.message,
                  }),
                ),
            }),
          ),
      QueryAnalyticsInsights: ({ queries }) =>
        analyticsService
          .queryAnalyticsInsights({
            queries: queries.map((query) => ({
              ...query,
              breakdowns: toMutableBreakdowns(query.breakdowns),
            })),
          })
          .pipe(
            Effect.catchTags({
              ActionForbiddenError: (error) =>
                Effect.fail(new RpcActionForbiddenError({ message: error.message })),
              AnalyticsServiceError: (error) =>
                Effect.fail(
                  new RpcAnalyticsServiceError({
                    cause: error.cause,
                    message: error.message,
                  }),
                ),
              InvalidAnalyticsQueryError: (error) =>
                Effect.fail(new RpcInvalidAnalyticsQueryError({ message: error.message })),
              InvalidTimeRangeError: (error) =>
                Effect.fail(new RpcInvalidTimeRangeError({ message: error.message })),
              UnknownInsightError: (error) =>
                Effect.fail(
                  new RpcUnknownInsightError({
                    insightId: error.insightId,
                    message: error.message,
                  }),
                ),
              UnsupportedAnalyticsBreakdownError: (error) =>
                Effect.fail(
                  new RpcUnsupportedAnalyticsBreakdownError({
                    field: error.field,
                    message: error.message,
                  }),
                ),
              UnsupportedAnalyticsFilterError: (error) =>
                Effect.fail(
                  new RpcUnsupportedAnalyticsFilterError({
                    field: error.field,
                    message: error.message,
                  }),
                ),
            }),
          ),
      QueryCustomAnalyticsInsight: (input) =>
        customAnalyticsService.queryInsight(input).pipe(
          Effect.catchTags({
            ...commonErrors,
            InvalidAnalyticsQueryError: (error) =>
              Effect.fail(new RpcInvalidAnalyticsQueryError({ message: error.message })),
            InvalidTimeRangeError: (error) =>
              Effect.fail(new RpcInvalidTimeRangeError({ message: error.message })),
          }),
        ),
      QueryCustomAnalyticsPersons: (input) =>
        customAnalyticsService.queryPersons(input).pipe(
          Effect.catchTags({
            ...commonErrors,
            InvalidAnalyticsQueryError: (error) =>
              Effect.fail(new RpcInvalidAnalyticsQueryError({ message: error.message })),
            InvalidTimeRangeError: (error) =>
              Effect.fail(new RpcInvalidTimeRangeError({ message: error.message })),
          }),
        ),
      ListAnalyticsInsights: (input) =>
        customAnalyticsService.listInsights(input).pipe(Effect.catchTags(commonErrors)),
      CreateAnalyticsInsight: (input) =>
        customAnalyticsService.createInsight(input).pipe(Effect.catchTags(commonErrors)),
      UpdateAnalyticsInsight: (input) =>
        customAnalyticsService.updateInsight(input).pipe(Effect.catchTags(commonErrors)),
      DeleteAnalyticsInsight: (input) =>
        customAnalyticsService.deleteInsight(input).pipe(Effect.catchTags(commonErrors)),
      ListAnalyticsCohorts: (input) =>
        customAnalyticsService.listCohorts(input).pipe(Effect.catchTags(commonErrors)),
      CreateAnalyticsCohort: (input) =>
        customAnalyticsService.createCohort(input).pipe(Effect.catchTags(commonErrors)),
      UpdateAnalyticsCohort: (input) =>
        customAnalyticsService.updateCohort(input).pipe(Effect.catchTags(commonErrors)),
      DeleteAnalyticsCohort: (input) =>
        customAnalyticsService.deleteCohort(input).pipe(Effect.catchTags(commonErrors)),
      ListAnalyticsDashboards: (input) =>
        customAnalyticsService.listDashboards(input).pipe(Effect.catchTags(commonErrors)),
      CreateAnalyticsDashboard: (input) =>
        customAnalyticsService.createDashboard(input).pipe(Effect.catchTags(commonErrors)),
      DuplicateAnalyticsDashboard: (input) =>
        customAnalyticsService.duplicateDashboard(input).pipe(Effect.catchTags(commonErrors)),
      UpdateAnalyticsDashboard: (input) =>
        customAnalyticsService.updateDashboard(input).pipe(Effect.catchTags(commonErrors)),
      DeleteAnalyticsDashboard: (input) =>
        customAnalyticsService.deleteDashboard(input).pipe(Effect.catchTags(commonErrors)),
      PutAnalyticsDashboardItem: (input) =>
        customAnalyticsService.putDashboardItem(input).pipe(Effect.catchTags(commonErrors)),
      ReorderAnalyticsDashboardItems: (input) =>
        customAnalyticsService.reorderDashboardItems(input).pipe(Effect.catchTags(commonErrors)),
      RemoveAnalyticsDashboardItem: (input) =>
        customAnalyticsService.removeDashboardItem(input).pipe(Effect.catchTags(commonErrors)),
    };
  }),
);
