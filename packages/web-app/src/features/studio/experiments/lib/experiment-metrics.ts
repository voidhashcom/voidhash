"use client";

import type { MetricRange } from "../../paywall-locations/lib/paywall-location-metrics.ts";

export interface ExperimentMetrics {
  readonly conversion: number;
  readonly purchases: number;
  readonly viewers: number;
  readonly views: number;
}

const EMPTY_METRICS: ExperimentMetrics = {
  conversion: 0,
  purchases: 0,
  viewers: 0,
  views: 0,
};

export interface UseExperimentMetricsResult {
  readonly isPending: boolean;
  readonly metricsFor: (locationSlugs: readonly string[]) => ExperimentMetrics;
}

/** Community does not ingest the custom paywall events required by experiment metrics. */
export function useExperimentMetrics(_options: {
  readonly projectId: string;
  readonly range: MetricRange;
}): UseExperimentMetricsResult {
  return { isPending: false, metricsFor: () => EMPTY_METRICS };
}
