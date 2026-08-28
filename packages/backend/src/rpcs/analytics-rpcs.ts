import { AnalyticsQuery } from "@voidhash/core-v2";
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
    const analytics = yield* AnalyticsQuery;
    return {
      ListRecentAnalyticsEvents: ({ projectId, limit }) =>
        analytics.listRecentEvents({ limit, projectId }).pipe(
          Effect.map((response) => ({
            events: response.events.map((event) => ({
              captureId: event.captureId,
              context: event.context,
              eventId: event.eventId,
              eventName: event.eventName,
              identityMode: event.identityMode,
              personDistinctId: event.distinctId,
              personEmail: null,
              personId: event.personId,
              personName: null,
              previousDistinctId: event.previousDistinctId,
              processedAt: event.processedAt,
              properties: event.properties,
              receivedAt: event.receivedAt,
              requestId: event.requestId,
              timestamp: event.timestamp,
            })),
            hasMore: response.hasMore,
          })),
          Effect.catchTags({
            AnalyticsQueryError: (error) =>
              Effect.fail(
                new RpcAnalyticsServiceError({ cause: error.cause, message: error.message }),
              ),
            AnalyticsAuthorizationDeniedError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
          }),
        ),
      QueryAnalyticsInsights: ({ queries }) =>
        Effect.forEach(queries, (query) =>
          analytics.queryOrganization({
            organizationId: query.context.organizationId,
            queries: [{ ...query, breakdowns: toMutableBreakdowns(query.breakdowns) }],
          }),
        ).pipe(
          Effect.map((results) => ({ results: results.flat() })),
          Effect.catchTags({
            AnalyticsQueryError: (error) =>
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
            AnalyticsAuthorizationDeniedError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
          }),
        ),
    };
  }),
);
