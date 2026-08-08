import type {
  AnalyticsFieldValueType,
  AnalyticsFilterType,
  AnalyticsGranularityType,
  AnalyticsTimeRangeType,
  BuiltInInsightIdType,
  QueryAnalyticsInsightsRequestType,
} from "@voidhash/rpc";

import type {
  DateRange,
  Granularity,
} from "@/features/studio/organizations/overview/date-range-filter";
import type { MetricValueFormat } from "@/features/studio/organizations/overview/format";

export interface AnalyticsMetricDefinition {
  id: BuiltInInsightIdType;
  key: string;
  label: string;
  valueFormat: MetricValueFormat;
}

export const OVERVIEW_INSIGHTS: readonly AnalyticsMetricDefinition[] = [
  {
    id: "builtin/revenue",
    key: "overview_revenue",
    label: "Revenue",
    valueFormat: "currency",
  },
  {
    id: "builtin/mrr",
    key: "overview_mrr",
    label: "MRR",
    valueFormat: "currency",
  },
  {
    id: "builtin/arr",
    key: "overview_arr",
    label: "ARR",
    valueFormat: "currency",
  },
  {
    id: "builtin/new_persons",
    key: "overview_new_persons",
    label: "New People",
    valueFormat: "number",
  },
  {
    id: "builtin/active_subscriptions",
    key: "overview_active_subscriptions",
    label: "Active Subscriptions",
    valueFormat: "number",
  },
  {
    id: "builtin/new_subscriptions",
    key: "overview_new_subscriptions",
    label: "New Subscriptions",
    valueFormat: "number",
  },
  {
    id: "builtin/churned_subscriptions",
    key: "overview_churned_subscriptions",
    label: "Churned Subscriptions",
    valueFormat: "number",
  },
  {
    id: "builtin/arpu",
    key: "overview_arpu",
    label: "ARPU",
    valueFormat: "currency",
  },
  {
    id: "builtin/trials",
    key: "overview_trials",
    label: "Trials",
    valueFormat: "number",
  },
] as const;

export const REVENUE_ANALYTICS_INSIGHTS: readonly AnalyticsMetricDefinition[] = [
  {
    id: "builtin/revenue",
    key: "revenue_revenue",
    label: "Revenue",
    valueFormat: "currency",
  },
  {
    id: "builtin/mrr",
    key: "revenue_mrr",
    label: "MRR",
    valueFormat: "currency",
  },
  {
    id: "builtin/mrr_growth_rate",
    key: "revenue_mrr_growth_rate",
    label: "MRR Growth Rate",
    valueFormat: "percent",
  },
  {
    id: "builtin/arr",
    key: "revenue_arr",
    label: "ARR",
    valueFormat: "currency",
  },
] as const;

export const SUBSCRIBER_ANALYTICS_INSIGHTS: readonly AnalyticsMetricDefinition[] = [
  {
    id: "builtin/active_subscriptions",
    key: "subscribers_active_subscriptions",
    label: "Active Subscriptions",
    valueFormat: "number",
  },
  {
    id: "builtin/active_subscribers_growth",
    key: "subscribers_active_subscribers_growth",
    label: "Active Subscribers Growth",
    valueFormat: "percent",
  },
  {
    id: "builtin/new_subscriptions",
    key: "subscribers_new_subscriptions",
    label: "New Subscribers",
    valueFormat: "number",
  },
  {
    id: "builtin/churned_subscriptions",
    key: "subscribers_churned_subscriptions",
    label: "Churned Subscribers",
    valueFormat: "number",
  },
  {
    id: "builtin/arpu",
    key: "subscribers_arpu",
    label: "ARPU",
    valueFormat: "currency",
  },
  {
    id: "builtin/subscriber_lifetime_value",
    key: "subscribers_subscriber_lifetime_value",
    label: "Subscriber Lifetime Value",
    valueFormat: "currency",
  },
] as const;

export const TRIAL_ANALYTICS_INSIGHTS: readonly AnalyticsMetricDefinition[] = [
  {
    id: "builtin/trials",
    key: "trials_new_trials",
    label: "New Trials",
    valueFormat: "number",
  },
  {
    id: "builtin/trial_conversion_rate",
    key: "trials_trial_conversion_rate",
    label: "Trial Conversion Rate",
    valueFormat: "percent",
  },
  {
    id: "builtin/active_trials",
    key: "trials_active_trials",
    label: "Active Trials",
    valueFormat: "number",
  },
  {
    id: "builtin/trial_conversions",
    key: "trials_trial_conversions",
    label: "Converted Trials",
    valueFormat: "number",
  },
] as const;

export const CHURN_ANALYTICS_INSIGHTS: readonly AnalyticsMetricDefinition[] = [
  {
    id: "builtin/churn_rate",
    key: "churn_subscriber_churn_rate",
    label: "Subscriber Churn Rate",
    valueFormat: "percent",
  },
  {
    id: "builtin/churned_revenue",
    key: "churn_churned_revenue",
    label: "Churned Revenue",
    valueFormat: "currency",
  },
] as const;

const buildPredicate = (
  field: string,
  op: "eq" | "neq" | "in" | "not_in" | "gt" | "gte" | "lt" | "lte" | "contains" | "exists",
  value: AnalyticsFieldValueType,
): AnalyticsFilterType => ({
  field,
  op,
  type: "predicate",
  value,
});

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const buildYesterdayRange = (): AnalyticsTimeRangeType => {
  const todayStart = startOfToday();
  return {
    end: new Date(todayStart.getTime() - 1),
    preset: "custom",
    start: new Date(todayStart.getTime() - 24 * 60 * 60 * 1000),
  };
};

const buildPreviousRange = (range: DateRange): AnalyticsTimeRangeType => {
  const now = new Date();
  const durationDays = range === "last_7d" ? 7 : range === "last_30d" ? 30 : 90;
  const currentStart = new Date(now.getTime() - durationDays * 24 * 60 * 60 * 1000);

  return {
    end: currentStart,
    preset: "custom",
    start: new Date(currentStart.getTime() - durationDays * 24 * 60 * 60 * 1000),
  };
};

const mapGranularity = (granularity: Granularity): AnalyticsGranularityType => {
  switch (granularity) {
    case "daily":
      return "day";
    case "weekly":
      return "week";
    case "monthly":
      return "month";
  }
};

const buildProjectFilter = (projectId?: string): AnalyticsFilterType | undefined =>
  projectId ? buildPredicate("project.id", "eq", projectId) : undefined;

export const buildMetricsAnalyticsRequest = ({
  dateRange,
  granularity,
  metrics,
  organizationId,
  projectId,
}: {
  dateRange: DateRange;
  granularity: Granularity;
  metrics: readonly AnalyticsMetricDefinition[];
  organizationId: string;
  projectId?: string;
}): QueryAnalyticsInsightsRequestType => {
  const baseFilter = buildProjectFilter(projectId);
  const context = {
    organizationId,
  } as const;
  const queries = metrics.flatMap((metric) => [
    {
      context,
      filter: baseFilter,
      granularity: mapGranularity(granularity),
      insightId: metric.id,
      key: `${metric.key}:current`,
      timeRange: {
        preset: dateRange,
      },
    },
    {
      context,
      filter: baseFilter,
      granularity: mapGranularity(granularity),
      insightId: metric.id,
      key: `${metric.key}:previous`,
      timeRange: buildPreviousRange(dateRange),
    },
  ]);

  return {
    queries: queries as unknown as QueryAnalyticsInsightsRequestType["queries"],
  };
};

export const buildOverviewAnalyticsRequest = ({
  dateRange,
  granularity,
  organizationId,
  projectId,
}: {
  dateRange: DateRange;
  granularity: Granularity;
  organizationId: string;
  projectId?: string;
}): QueryAnalyticsInsightsRequestType => {
  return {
    queries: [
      {
        context: {
          organizationId,
        },
        filter: buildProjectFilter(projectId),
        granularity: "hour",
        insightId: "builtin/revenue",
        key: "today_revenue_current",
        timeRange: {
          preset: "today",
        },
      },
      {
        context: {
          organizationId,
        },
        filter: buildProjectFilter(projectId),
        granularity: "hour",
        insightId: "builtin/revenue",
        key: "today_revenue_previous",
        timeRange: buildYesterdayRange(),
      },
      ...buildMetricsAnalyticsRequest({
        dateRange,
        granularity,
        metrics: OVERVIEW_INSIGHTS,
        organizationId,
        projectId,
      }).queries,
    ],
  };
};
