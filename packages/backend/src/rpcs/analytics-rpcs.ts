import { AnalyticsService } from "@voidhash/core/services";
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

const toMutableBreakdowns = <T>(breakdowns: readonly T[] | undefined): T[] | undefined => {
  if (!breakdowns) return undefined;
  return [...breakdowns];
};

/** Community analytics handlers: recent events and built-in revenue insights. */
export const AnalyticsRpcsLive = AnalyticsRpcsDef.toLayer(
  Effect.gen(function* AnalyticsRpcsLive() {
    const analyticsService = yield* AnalyticsService;
    return {
      ListRecentAnalyticsEvents: ({ projectId, limit }) =>
        analyticsService.listRecentEvents({ limit, projectId }).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            AnalyticsServiceError: (error) =>
              Effect.fail(
                new RpcAnalyticsServiceError({ cause: error.cause, message: error.message }),
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
                  new RpcAnalyticsServiceError({ cause: error.cause, message: error.message }),
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
    };
  }),
);
