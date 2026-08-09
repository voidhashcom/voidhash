import type {
  AnalyticsInsightResponseItemType,
  AnalyticsInsightResultType,
  AnalyticsSummaryType,
} from "@voidhash/rpc";

import { OVERVIEW_INSIGHTS, type AnalyticsMetricDefinition } from "./query-builders";
import type { OverviewMetricCardData } from "@/features/studio/organizations/overview/overview-section";
import type { OverviewTimeSeriesPoint } from "@/features/studio/organizations/overview/today-chart";

const toSeries = (result: AnalyticsInsightResultType): OverviewTimeSeriesPoint[] => {
  switch (result.kind) {
    case "metric":
      return result.sparkline.map((point) => ({
        date: point.timestamp.toISOString(),
        value: point.value,
      }));
    case "timeseries":
      return result.series.map((point) => ({
        date: point.timestamp.toISOString(),
        value: point.value,
      }));
    case "breakdown":
      return [];
  }
};

const toSummary = (result: AnalyticsInsightResultType): AnalyticsSummaryType | undefined => {
  switch (result.kind) {
    case "metric":
    case "timeseries":
      return result.summary;
    case "breakdown":
      return result.summary;
  }
};

const calculatePercentChange = (current: number, previous: number | null): number | null => {
  if (previous === null) {
    return null;
  }

  if (previous === 0) {
    return current > 0 ? 100 : null;
  }

  return ((current - previous) / previous) * 100;
};

export const mapAnalyticsResultsByKey = (results: readonly AnalyticsInsightResponseItemType[]) =>
  new Map(results.map((result) => [result.key, result]));

export const buildMetricCards = (
  insights: readonly AnalyticsMetricDefinition[],
  resultsByKey: Map<string, AnalyticsInsightResponseItemType>,
): OverviewMetricCardData[] =>
  insights.map((insight) => {
    const current = resultsByKey.get(`${insight.key}:current`);
    const previous = resultsByKey.get(`${insight.key}:previous`);
    const currentSummary = current ? toSummary(current.result) : undefined;
    const previousSummary = previous ? toSummary(previous.result) : undefined;

    return {
      currentValue: currentSummary?.value ?? 0,
      id: insight.key,
      label: insight.label,
      percentChange: calculatePercentChange(
        currentSummary?.value ?? 0,
        previousSummary?.value ?? null,
      ),
      previousValue: previousSummary?.value ?? null,
      timeSeries: current ? toSeries(current.result) : [],
      valueFormat: insight.valueFormat,
    };
  });

export const buildOverviewMetricCards = (
  resultsByKey: Map<string, AnalyticsInsightResponseItemType>,
): OverviewMetricCardData[] => buildMetricCards(OVERVIEW_INSIGHTS, resultsByKey);

export const buildTodayChartData = (
  resultsByKey: Map<string, AnalyticsInsightResponseItemType>,
) => {
  const current = resultsByKey.get("today_revenue_current");
  const previous = resultsByKey.get("today_revenue_previous");

  return {
    grossRevenue:
      toSummary(current?.result ?? { kind: "metric", sparkline: [], summary: { value: 0 } })
        ?.value ?? 0,
    timeSeries: current ? toSeries(current.result) : [],
    yesterdayRevenue: previous ? (toSummary(previous.result)?.value ?? null) : null,
  };
};
