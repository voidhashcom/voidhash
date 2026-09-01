import { QueryInsightsResult, VoidhashV1Api } from "@voidhash/api-contracts";
import {
  ApiActionForbiddenError,
  ApiAnalyticsServiceError,
  ApiInvalidMetricError,
  ApiInvalidTimeRangeError,
  ApiUnknownInsightError,
} from "@voidhash/api-contracts/errors";
import { AnalyticsQuery } from "@voidhash/core-v2";
import { resolveRequestProjectId } from "@voidhash/core/utils";
import { AuthSession } from "@voidhash/rpc";
import * as Effect from "effect/Effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { bridgeAuthSession, requireCredential } from "../../ApiMiddlewares.ts";
import * as Schema from "effect/Schema";

/** Breakdowns arrive as a readonly wire array; the insight engine takes a mutable copy. */
const toBreakdowns = <B>(breakdowns: ReadonlyArray<B> | typeof Schema.Undefined.Type): Array<B> | typeof Schema.Undefined.Type => {
  if (!breakdowns) return undefined;
  return [...breakdowns];
};

export const AnalyticsGroupLive = HttpApiBuilder.group(VoidhashV1Api, "analytics", (handlers) =>
  Effect.gen(function* () {
    const analytics = yield* AnalyticsQuery;

    return handlers.handle("queryInsights", ({ payload }) =>
      bridgeAuthSession(
        Effect.fn("AnalyticsGroupLive")(function* () {
          const authSession = yield* AuthSession;
          yield* requireCredential(authSession, ["user", "secret-key"]);
          const projectId = yield* resolveRequestProjectId(authSession, payload.projectId);
          const results = yield* analytics.queryProject({
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
          return new QueryInsightsResult({ results });
        })(),
      ).pipe(
        Effect.catchTags({
          ActionForbiddenError: (e) =>
            Effect.fail(new ApiActionForbiddenError({ message: e.message })),
          AnalyticsAuthorizationDeniedError: (e) =>
            Effect.fail(new ApiActionForbiddenError({ message: e.message })),
          AnalyticsQueryError: (e) => Effect.fail(new ApiAnalyticsServiceError({ cause: e.cause })),
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
