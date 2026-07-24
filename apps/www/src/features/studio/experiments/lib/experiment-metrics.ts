"use client";

import { useQuery } from "@tanstack/react-query";
import type { CustomAnalyticsInsightQueryType } from "@voidhash/rpc";
import { customAnalyticsInsightQueryOptions } from "@/features/studio/lib/tanstack-query/analytics";
import {
  CONVERSION_WINDOW_SECONDS,
  PAYWALL_VIEWED_EVENT,
  PURCHASE_COMPLETED_EVENT,
  type MetricRange,
} from "@/features/studio/paywall-locations/lib/paywall-location-metrics";

// A/B tests change what a paywall location serves, so a test's traffic is the
// traffic at the locations its treatments target. Events carry the location
// slug in `paywall_location` and nothing that identifies the test, so the index
// table breaks down by location and sums an experiment's locations together —
// the same two queries that feed the Paywall Locations table.
const LOCATION_BREAKDOWN = {
  field: "event.properties.paywall_location",
  limit: 100,
  order: "desc",
} as const;

export interface ExperimentMetrics {
  /** Share of viewers who purchased within the conversion window, 0–1. */
  conversion: number;
  purchases: number;
  viewers: number;
  views: number;
}

const EMPTY_METRICS: ExperimentMetrics = {
  conversion: 0,
  purchases: 0,
  viewers: 0,
  views: 0,
};

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

export interface UseExperimentMetricsResult {
  isPending: boolean;
  /** Metrics summed across a test's target locations; zeroed when it targets none. */
  metricsFor: (locationSlugs: readonly string[]) => ExperimentMetrics;
}

/**
 * Loads engagement metrics for every A/B test in the project at once. Breakdown
 * series come back keyed `<seriesKey>:<locationSlug>`, so one response fans out
 * across the index table's rows.
 *
 * Counts are summed across a test's locations; conversion is recomputed from
 * the summed viewer/converter counts rather than averaged, so a test spanning
 * locations of very different sizes isn't skewed by the smallest one.
 */
export function useExperimentMetrics(options: {
  projectId: string;
  range: MetricRange;
}): UseExperimentMetricsResult {
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

  const metricsFor = (locationSlugs: readonly string[]): ExperimentMetrics => {
    if (locationSlugs.length === 0 || !(totals || funnel)) {
      return EMPTY_METRICS;
    }

    const sumFor = (seriesKey: string) =>
      locationSlugs.reduce(
        (total, slug) =>
          total +
          (totals?.series.find((series) => series.key === `${seriesKey}:${slug}`)?.points[0]
            ?.value ?? 0),
        0,
      );

    const viewers = sumFor("viewers");
    // The funnel reports a rate per location; multiplying it back out by that
    // location's viewers recovers converter counts we can add up.
    const converters = locationSlugs.reduce((total, slug) => {
      const entry = funnel?.breakdowns?.find((breakdown) => breakdown.breakdownValue === slug);
      const locationViewers =
        totals?.series.find((series) => series.key === `viewers:${slug}`)?.points[0]?.value ?? 0;
      return total + (entry?.totalConversionRate ?? 0) * locationViewers;
    }, 0);

    return {
      conversion: viewers > 0 ? converters / viewers : 0,
      purchases: sumFor("purchases"),
      viewers,
      views: sumFor("views"),
    };
  };

  return {
    isPending: totalsQuery.isPending || funnelQuery.isPending,
    metricsFor,
  };
}
