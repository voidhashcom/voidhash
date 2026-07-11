import { AnalyticsService } from "@voidhash/core/services";
// Imported so the inferred `AnalyticsRpcsLive` layer type (whose requirements
// include the analytics read path's `ClickhouseWebClient`) is nameable in the
// emitted declarations — the client is re-exported as a namespace, which TS
// cannot otherwise reference portably (TS2883).
import { ClickhouseWebClient } from "@voidhash/clickhouse-db/clickhouse-client-web";
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

export const AnalyticsRpcsLive = AnalyticsRpcsDef.toLayer(
  Effect.gen(function* AnalyticsRpcsLive() {
    const analyticsService = yield* AnalyticsService;

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
                  new RpcAnalyticsServiceError({ cause: error.cause, message: error.message }),
                ),
            }),
          ),
      QueryAnalyticsInsights: ({ queries }) =>
        analyticsService
          .queryAnalyticsInsights({
            queries: queries.map((query) => ({
              ...query,
              breakdowns: query.breakdowns ? [...query.breakdowns] : undefined,
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
