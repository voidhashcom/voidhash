"use client";

import { useQuery } from "@tanstack/react-query";
import type { AnalyticsFilterType, CustomAnalyticsInsightQueryType } from "@voidhash/rpc";
import { customAnalyticsInsightQueryOptions } from "@/features/studio/lib/tanstack-query/analytics";

// Conventional event names emitted by paywall compositions through the SDK
// bridge. Every bridge event is stamped with the `paywall_location` property
// holding the slug of the location that served the paywall, which is what
// scopes these queries to a single location.
export const PAYWALL_VIEWED_EVENT = "paywall_viewed";
export const PURCHASE_COMPLETED_EVENT = "purchase_completed";

export const CONVERSION_WINDOW_SECONDS = 7 * 86_400;

// The trends breakdown caps out at 100 buckets server-side; a project with more
// paywall locations than that loses metrics for the tail, which the index table
// renders as "no data" rather than zero.
const BREAKDOWN_LIMIT = 100;

export const METRIC_RANGE_OPTIONS = [
  { label: "7D", value: "last_7d" },
  { label: "30D", value: "last_30d" },
  { label: "90D", value: "last_90d" },
] as const;

export type MetricRange = (typeof METRIC_RANGE_OPTIONS)[number]["value"];

export const isMetricRange = (value: string): value is MetricRange =>
  METRIC_RANGE_OPTIONS.some((option) => option.value === value);

/**
 * Predicate scoping a series to the events served by a set of paywall
 * locations. `paywall_location` carries the location slug, not its id.
 */
export const paywallLocationFilter = (locationSlugs: readonly string[]): AnalyticsFilterType => ({
  field: "event.properties.paywall_location",
  op: "in",
  type: "predicate",
  value: [...locationSlugs],
});

const LOCATION_BREAKDOWN = {
  field: "event.properties.paywall_location",
  limit: BREAKDOWN_LIMIT,
  order: "desc",
} as const;

export interface PaywallLocationMetrics {
  /** Share of viewers who purchased within the conversion window, 0–1. */
  conversion: number;
  purchases: number;
  viewers: number;
  views: number;
}

const EMPTY_METRICS: PaywallLocationMetrics = {
  conversion: 0,
  purchases: 0,
  viewers: 0,
  views: 0,
};

/**
 * Engagement metrics for every paywall location in the project, split by the
 * `paywall_location` breakdown so the whole index table is served by two
 * queries rather than two per row.
 */
const buildBreakdownTotalsDefinition = (range: MetricRange): CustomAnalyticsInsightQueryType => ({
  breakdown: LOCATION_BREAKDOWN,
  display: "number",
  granularity: "day",
  kind: "trends",
  series: [
    {
      aggregation: "total_events",
      eventNames: [PAYWALL_VIEWED_EVENT],
      key: "views",
      label: "Views",
    },
    {
      aggregation: "unique_users",
      eventNames: [PAYWALL_VIEWED_EVENT],
      key: "viewers",
      label: "Unique viewers",
    },
    {
      aggregation: "total_events",
      eventNames: [PURCHASE_COMPLETED_EVENT],
      key: "purchases",
      label: "Purchases",
    },
  ],
  timeRange: { preset: range },
});

// The purchase step is intentionally unfiltered and unbroken-down: the funnel is
// sequential per user, so it measures "viewed a paywall here, then purchased"
// even though purchase events are not stamped with the location. Attributing the
// breakdown to step 1 buckets each user by where they entered.
const buildBreakdownFunnelDefinition = (range: MetricRange): CustomAnalyticsInsightQueryType => ({
  breakdown: LOCATION_BREAKDOWN,
  breakdownAttributionStep: 1,
  conversionWindowSeconds: CONVERSION_WINDOW_SECONDS,
  kind: "funnels",
  order: "sequential",
  steps: [
    { eventNames: [PAYWALL_VIEWED_EVENT], key: "viewed", label: "Viewed paywall" },
    { eventNames: [PURCHASE_COMPLETED_EVENT], key: "purchased", label: "Purchased" },
  ],
  timeRange: { preset: range },
});

export interface UsePaywallLocationMetricsResult {
  isPending: boolean;
  /** Metrics for one location slug; zeroed when the location saw no traffic. */
  metricsFor: (locationSlug: string) => PaywallLocationMetrics;
}

/**
 * Loads engagement metrics for every paywall location in the project at once.
 * Breakdown series come back keyed `<seriesKey>:<locationSlug>`, which is what
 * lets a single response fan out across the index table's rows.
 */
export function usePaywallLocationMetrics(options: {
  projectId: string;
  range: MetricRange;
}): UsePaywallLocationMetricsResult {
  const { projectId, range } = options;

  const totalsQuery = useQuery(
    customAnalyticsInsightQueryOptions({
      definition: buildBreakdownTotalsDefinition(range),
      projectId,
    }),
  );
  const funnelQuery = useQuery(
    customAnalyticsInsightQueryOptions({
      definition: buildBreakdownFunnelDefinition(range),
      projectId,
    }),
  );

  const totals = totalsQuery.data?.kind === "trends" ? totalsQuery.data : undefined;
  const funnel = funnelQuery.data?.kind === "funnels" ? funnelQuery.data : undefined;

  const metricsFor = (locationSlug: string): PaywallLocationMetrics => {
    if (!(totals || funnel)) {
      return EMPTY_METRICS;
    }

    const totalFor = (seriesKey: string) =>
      totals?.series.find((series) => series.key === `${seriesKey}:${locationSlug}`)?.points[0]
        ?.value ?? 0;

    return {
      conversion:
        funnel?.breakdowns?.find((entry) => entry.breakdownValue === locationSlug)
          ?.totalConversionRate ?? 0,
      purchases: totalFor("purchases"),
      viewers: totalFor("viewers"),
      views: totalFor("views"),
    };
  };

  return {
    isPending: totalsQuery.isPending || funnelQuery.isPending,
    metricsFor,
  };
}

export const buildLocationTotalsDefinition = (
  range: MetricRange,
  locationSlugs: readonly string[],
): CustomAnalyticsInsightQueryType => ({
  display: "number",
  granularity: "day",
  kind: "trends",
  series: [
    {
      aggregation: "total_events",
      eventNames: [PAYWALL_VIEWED_EVENT],
      filters: paywallLocationFilter(locationSlugs),
      key: "views",
      label: "Views",
    },
    {
      aggregation: "unique_users",
      eventNames: [PAYWALL_VIEWED_EVENT],
      filters: paywallLocationFilter(locationSlugs),
      key: "viewers",
      label: "Unique viewers",
    },
    {
      aggregation: "total_events",
      eventNames: [PURCHASE_COMPLETED_EVENT],
      filters: paywallLocationFilter(locationSlugs),
      key: "purchases",
      label: "Purchases",
    },
  ],
  timeRange: { preset: range },
});

export const buildLocationTimeseriesDefinition = (
  range: MetricRange,
  locationSlugs: readonly string[],
): CustomAnalyticsInsightQueryType => ({
  display: "area",
  granularity: "day",
  kind: "trends",
  series: [
    {
      aggregation: "total_events",
      eventNames: [PAYWALL_VIEWED_EVENT],
      filters: paywallLocationFilter(locationSlugs),
      key: "views",
      label: "Views",
    },
    {
      aggregation: "total_events",
      eventNames: [PURCHASE_COMPLETED_EVENT],
      filters: paywallLocationFilter(locationSlugs),
      key: "purchases",
      label: "Purchases",
    },
  ],
  timeRange: { preset: range },
});

export const buildLocationFunnelDefinition = (
  range: MetricRange,
  locationSlugs: readonly string[],
): CustomAnalyticsInsightQueryType => ({
  conversionWindowSeconds: CONVERSION_WINDOW_SECONDS,
  kind: "funnels",
  order: "sequential",
  steps: [
    {
      eventNames: [PAYWALL_VIEWED_EVENT],
      filters: paywallLocationFilter(locationSlugs),
      key: "viewed",
      label: "Viewed paywall",
    },
    { eventNames: [PURCHASE_COMPLETED_EVENT], key: "purchased", label: "Purchased" },
  ],
  timeRange: { preset: range },
});
