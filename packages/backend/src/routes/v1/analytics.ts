import { QueryInsightsResult, VoidhashV1Api } from "@voidhash/api-contracts";
import {
  ApiActionForbiddenError,
  ApiAnalyticsServiceError,
  ApiInvalidMetricError,
  ApiInvalidTimeRangeError,
  ApiUnknownInsightError,
} from "@voidhash/api-contracts/errors";
import { AnalyticsService } from "@voidhash/core/services";
import { resolveRequestProjectId } from "@voidhash/core/utils";
import { AuthSession } from "@voidhash/rpc";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { bridgeAuthSession, requireCredential } from "../../ApiMiddlewares.ts";

/** Breakdowns arrive as a readonly wire array; the insight engine takes a mutable copy. */
const toBreakdowns = <B>(breakdowns: ReadonlyArray<B> | undefined): Array<B> | undefined => {
  if (!breakdowns) return undefined;
  return [...breakdowns];
};

export const AnalyticsGroupLive = HttpApiBuilder.group(VoidhashV1Api, "analytics", (handlers) =>
  Effect.gen(function* () {
    const analyticsService = yield* AnalyticsService;

    return handlers.handle("queryInsights", ({ payload }) =>
      bridgeAuthSession(
        Effect.gen(function* () {
          const authSession = yield* AuthSession;
          yield* requireCredential(authSession, ["user", "secret-key"]);
          const projectId = yield* resolveRequestProjectId(authSession, payload.projectId);
          const response = yield* analyticsService.queryProjectAnalyticsInsights({
            projectId,
            queries: payload.queries.map((query) => ({
              breakdowns: toBreakdowns(query.breakdowns),
              filter: query.filter,
              granularity: query.granularity,
              insightId: query.insightId,
              key: query.key,
              limit: query.limit,
              timeRange: query.timeRange,
            })),
          });
          return new QueryInsightsResult({ results: response.results });
        }),
      ).pipe(
        Effect.catchTags({
          ActionForbiddenError: (e) =>
            Effect.fail(new ApiActionForbiddenError({ message: e.message })),
          AnalyticsServiceError: (e) =>
            Effect.fail(new ApiAnalyticsServiceError({ cause: e.cause })),
          InvalidAnalyticsQueryError: (e) =>
            Effect.fail(new ApiInvalidMetricError({ message: e.message })),
          InvalidTimeRangeError: (e) =>
            Effect.fail(new ApiInvalidTimeRangeError({ message: e.message })),
          UnknownInsightError: (e) =>
            Effect.fail(new ApiUnknownInsightError({ insightId: e.insightId, message: e.message })),
          UnsupportedAnalyticsBreakdownError: (e) =>
            Effect.fail(new ApiInvalidMetricError({ message: `${e.message} (field: ${e.field})` })),
          UnsupportedAnalyticsFilterError: (e) =>
            Effect.fail(new ApiInvalidMetricError({ message: `${e.message} (field: ${e.field})` })),
        }),
      ),
    );
  }),
);
