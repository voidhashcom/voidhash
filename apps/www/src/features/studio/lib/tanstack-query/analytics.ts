import { Effect } from "effect";
import type { QueryAnalyticsInsightsRequestType } from "@voidhash/rpc";

import { VoidhashRpc, eq } from "../effect-query";
import { queryKeys } from "./query-keys";

export const queryAnalyticsInsightsOptions = (options: QueryAnalyticsInsightsRequestType) =>
  eq.queryOptions({
    queryFn: (() =>
      Effect.gen(function* queryAnalyticsInsightsQueryFn() {
        const analytics = yield* VoidhashRpc.request((rpc) => rpc.QueryAnalyticsInsights(options));
        return analytics;
      })) as never,
    queryKey: queryKeys.analytics.query(options),
  });

export const listRecentAnalyticsEventsOptions = (options: { projectId: string; limit: number }) =>
  eq.queryOptions({
    queryFn: () =>
      VoidhashRpc.request((rpc) =>
        rpc.ListRecentAnalyticsEvents({
          limit: options.limit,
          projectId: options.projectId,
        }),
      ),
    queryKey: queryKeys.analytics.recentEvents(options),
  });
