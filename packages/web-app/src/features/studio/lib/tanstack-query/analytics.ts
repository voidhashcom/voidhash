import type { QueryAnalyticsInsightsRequestType } from "@voidhash/rpc";

import { VoidhashRpc, eq } from "../effect-query";
import { queryKeys } from "./query-keys";

/** Build query options for the built-in analytics insight batch endpoint. */
export const queryAnalyticsInsightsOptions = (options: QueryAnalyticsInsightsRequestType) =>
  eq.queryOptions({
    queryFn: () => VoidhashRpc.request((rpc) => rpc.QueryAnalyticsInsights(options)),
    queryKey: queryKeys.analytics.query(options),
  });

/** Build query options for a project's recent event stream. */
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
