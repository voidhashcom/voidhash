import { Effect } from "effect";
import type {
  CustomAnalyticsInsightQueryType,
  QueryAnalyticsInsightsRequestType,
  QueryCustomAnalyticsPersonsRequestType,
} from "@voidhash/rpc";

import { VoidhashRpc, eq } from "../effect-query";
import { queryKeys } from "./query-keys";

/** Build query options for the built-in analytics insight batch endpoint. */
export const queryAnalyticsInsightsOptions = (options: QueryAnalyticsInsightsRequestType) =>
  eq.queryOptions({
    queryFn: (() =>
      Effect.gen(function* queryAnalyticsInsightsQueryFn() {
        const analytics = yield* VoidhashRpc.request((rpc) => rpc.QueryAnalyticsInsights(options));
        return analytics;
      })) as never,
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

/** Build query options for the project's saved custom insights. */
export const listAnalyticsInsightsOptions = (options: { projectId: string }) =>
  eq.queryOptions({
    queryFn: () => VoidhashRpc.request((rpc) => rpc.ListAnalyticsInsights(options)),
    queryKey: queryKeys.analytics.insights(options),
  });

/** Build mutation options for saving a custom insight. */
export const createAnalyticsInsightOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: {
      definition: CustomAnalyticsInsightQueryType;
      description?: string;
      name: string;
      projectId: string;
    }) => VoidhashRpc.request((rpc) => rpc.CreateAnalyticsInsight(variables)),
    mutationKey: ["createAnalyticsInsight"],
  });

/** Build mutation options for updating a saved custom insight. */
export const updateAnalyticsInsightOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: {
      definition?: CustomAnalyticsInsightQueryType;
      description?: null | string;
      id: string;
      name?: string;
    }) => VoidhashRpc.request((rpc) => rpc.UpdateAnalyticsInsight(variables)),
    mutationKey: ["updateAnalyticsInsight"],
  });

/** Build mutation options for deleting a saved custom insight. */
export const deleteAnalyticsInsightOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { id: string }) =>
      VoidhashRpc.request((rpc) => rpc.DeleteAnalyticsInsight(variables)),
    mutationKey: ["deleteAnalyticsInsight"],
  });

/** Build query options for reusable project cohorts. */
export const listAnalyticsCohortsOptions = (options: { projectId: string }) =>
  eq.queryOptions({
    queryFn: () => VoidhashRpc.request((rpc) => rpc.ListAnalyticsCohorts(options)),
    queryKey: queryKeys.analytics.cohorts(options),
  });

/** Build mutation options for creating a static analytics cohort. */
export const createAnalyticsCohortOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: {
      description?: string;
      memberPersonIds: string[];
      name: string;
      projectId: string;
    }) => VoidhashRpc.request((rpc) => rpc.CreateAnalyticsCohort(variables)),
    mutationKey: ["createAnalyticsCohort"],
  });

/** Build mutation options for updating cohort metadata or membership. */
export const updateAnalyticsCohortOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: {
      description?: null | string;
      id: string;
      memberPersonIds?: string[];
      name?: string;
    }) => VoidhashRpc.request((rpc) => rpc.UpdateAnalyticsCohort(variables)),
    mutationKey: ["updateAnalyticsCohort"],
  });

/** Build mutation options for deleting a static cohort. */
export const deleteAnalyticsCohortOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { id: string }) =>
      VoidhashRpc.request((rpc) => rpc.DeleteAnalyticsCohort(variables)),
    mutationKey: ["deleteAnalyticsCohort"],
  });

/** Build mutation options for running an ad hoc custom insight definition. */
export const queryCustomAnalyticsInsightOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { definition: CustomAnalyticsInsightQueryType; projectId: string }) =>
      VoidhashRpc.request((rpc) => rpc.QueryCustomAnalyticsInsight(variables)),
    mutationKey: ["queryCustomAnalyticsInsight"],
  });

/** Build mutation options for listing people behind a selected insight segment. */
export const queryCustomAnalyticsPersonsOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: QueryCustomAnalyticsPersonsRequestType) =>
      VoidhashRpc.request((rpc) => rpc.QueryCustomAnalyticsPersons(variables)),
    mutationKey: ["queryCustomAnalyticsPersons"],
  });

/** Build cacheable query options for a saved insight card. */
export const customAnalyticsInsightQueryOptions = (variables: {
  definition: CustomAnalyticsInsightQueryType;
  projectId: string;
}) =>
  eq.queryOptions({
    queryFn: () => VoidhashRpc.request((rpc) => rpc.QueryCustomAnalyticsInsight(variables)),
    queryKey: queryKeys.analytics.customInsight(variables),
  });

/** Build query options for project dashboards and their insight placements. */
export const listAnalyticsDashboardsOptions = (options: { projectId: string }) =>
  eq.queryOptions({
    queryFn: () => VoidhashRpc.request((rpc) => rpc.ListAnalyticsDashboards(options)),
    queryKey: queryKeys.analytics.dashboards(options),
  });

/** Build mutation options for creating an analytics dashboard. */
export const createAnalyticsDashboardOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { description?: string; name: string; projectId: string }) =>
      VoidhashRpc.request((rpc) => rpc.CreateAnalyticsDashboard(variables)),
    mutationKey: ["createAnalyticsDashboard"],
  });

/** Build mutation options for duplicating a dashboard and its card layout. */
export const duplicateAnalyticsDashboardOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { id: string; name?: string }) =>
      VoidhashRpc.request((rpc) => rpc.DuplicateAnalyticsDashboard(variables)),
    mutationKey: ["duplicateAnalyticsDashboard"],
  });

/** Build mutation options for updating dashboard metadata. */
export const updateAnalyticsDashboardOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { description?: null | string; id: string; name?: string }) =>
      VoidhashRpc.request((rpc) => rpc.UpdateAnalyticsDashboard(variables)),
    mutationKey: ["updateAnalyticsDashboard"],
  });

/** Build mutation options for deleting a dashboard. */
export const deleteAnalyticsDashboardOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { id: string }) =>
      VoidhashRpc.request((rpc) => rpc.DeleteAnalyticsDashboard(variables)),
    mutationKey: ["deleteAnalyticsDashboard"],
  });

/** Build mutation options for adding or repositioning a dashboard card. */
export const putAnalyticsDashboardItemOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: {
      dashboardId: string;
      layout: { height: number; width: number; x: number; y: number };
      position: number;
      source: { id: string; kind: "insight" | "voidql" };
    }) => VoidhashRpc.request((rpc) => rpc.PutAnalyticsDashboardItem(variables)),
    mutationKey: ["putAnalyticsDashboardItem"],
  });

/** Build mutation options for atomically reordering all dashboard cards. */
export const reorderAnalyticsDashboardItemsOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { dashboardId: string; itemIds: [string, ...string[]] }) =>
      VoidhashRpc.request((rpc) => rpc.ReorderAnalyticsDashboardItems(variables)),
    mutationKey: ["reorderAnalyticsDashboardItems"],
  });

/** Build mutation options for removing a card from a dashboard. */
export const removeAnalyticsDashboardItemOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { dashboardId: string; itemId: string }) =>
      VoidhashRpc.request((rpc) => rpc.RemoveAnalyticsDashboardItem(variables)),
    mutationKey: ["removeAnalyticsDashboardItem"],
  });
