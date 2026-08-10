"use client";

export const METRIC_RANGE_OPTIONS = [
  { label: "7D", value: "last_7d" },
  { label: "30D", value: "last_30d" },
  { label: "90D", value: "last_90d" },
] as const;

export type MetricRange = (typeof METRIC_RANGE_OPTIONS)[number]["value"];

export const isMetricRange = (value: string): value is MetricRange =>
  METRIC_RANGE_OPTIONS.some((option) => option.value === value);

export interface PaywallLocationMetrics {
  readonly conversion: number;
  readonly purchases: number;
  readonly viewers: number;
  readonly views: number;
}

const EMPTY_METRICS: PaywallLocationMetrics = {
  conversion: 0,
  purchases: 0,
  viewers: 0,
  views: 0,
};

export interface UsePaywallLocationMetricsResult {
  readonly isPending: boolean;
  readonly metricsFor: (locationSlug: string) => PaywallLocationMetrics;
}

/** Community does not ingest the custom paywall events required by these metrics. */
export function usePaywallLocationMetrics(_options: {
  readonly projectId: string;
  readonly range: MetricRange;
}): UsePaywallLocationMetricsResult {
  return { isPending: false, metricsFor: () => EMPTY_METRICS };
}
