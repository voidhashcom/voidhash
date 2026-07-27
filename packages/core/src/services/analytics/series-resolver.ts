/**
 * Pure series-resolution logic for the analytics insights operation. Splits
 * the recursive metric-derivation graph (e.g. ARR = MRR x 12, churn-rate =
 * churned / active+churned) out of the orchestration layer so the service
 * file stays focused on permission checks and `catchTags`.
 *
 * `buildSeriesResolver` returns a closure with a per-call cache so derived
 * metrics that share inputs (ARPU + ARPPU both use Revenue) don't re-issue
 * the underlying ClickHouse query. Every metric is scoped to `organizationId`,
 * which is passed through to the readonly ClickHouse user's tenant row
 * policies and keyed into the cache.
 */
import { Effect } from "effect";

import type {
  AnalyticsDataPoint,
  BuiltInInsightId,
  CompiledAnalyticsFilter,
  TimeGranularity,
  TimeRangeParams,
} from "../../domain/analytics/Analytics.ts";
import type { ClickhouseWebClient } from "@voidhash/clickhouse-db/clickhouse-client-web";
import type { SqlError } from "effect/unstable/sql/SqlError";
import type { AnalyticsDataAccessor } from "./clickhouse-accessor.ts";

const calculateRate = (numerator: number, denominator: number): number =>
  denominator > 0 ? (numerator / denominator) * 100 : 0;

const calculateGrowthRate = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

const executePrimitiveMetric = ({
  accessor,
  compiledFilter,
  insightId,
  organizationId,
  params,
}: {
  accessor: AnalyticsDataAccessor;
  compiledFilter: CompiledAnalyticsFilter;
  insightId: BuiltInInsightId;
  organizationId: string;
  params: TimeRangeParams;
}): Effect.Effect<AnalyticsDataPoint[], SqlError, ClickhouseWebClient.ClickhouseWebClient> => {
  const input = { filters: compiledFilter, organizationId, params };
  switch (insightId) {
    case "builtin/revenue":
      return accessor.getRevenue(input);
    case "builtin/mrr":
      return accessor.getMRR(input);
    case "builtin/churned_revenue":
      return accessor.getChurnedRevenue(input);
    case "builtin/active_subscriptions":
      return accessor.getActiveSubscriptions(input);
    case "builtin/active_trials":
      return accessor.getActiveTrials(input);
    case "builtin/new_subscriptions":
      return accessor.getNewSubscriptions(input);
    case "builtin/churned_subscriptions":
      return accessor.getChurnedSubscriptions(input);
    case "builtin/trials":
      return accessor.getTrials(input);
    case "builtin/trial_conversions":
      return accessor.getTrialConversions(input);
    case "builtin/person_count":
      return accessor.getPersonCount(input);
    case "builtin/new_persons":
      return accessor.getNewPersons(input);
    default:
      return Effect.die(new Error(`Unexpected primitive insight ${insightId}`));
  }
};

export const buildSeriesResolver = (accessor: AnalyticsDataAccessor) => {
  const cache = new Map<string, AnalyticsDataPoint[]>();

  const getSeries = (
    insightId: BuiltInInsightId,
    compiledFilter: CompiledAnalyticsFilter,
    granularity: TimeGranularity,
    timeRange: { end: Date; start: Date },
    organizationId: string,
  ): Effect.Effect<AnalyticsDataPoint[], SqlError, ClickhouseWebClient.ClickhouseWebClient> =>
    Effect.gen(function* () {
      const cacheKey = JSON.stringify({
        compiledFilter,
        granularity,
        insightId,
        organizationId,
        timeRange,
      });
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      const params: TimeRangeParams = {
        endDate: timeRange.end,
        granularity,
        startDate: timeRange.start,
      };

      const series = yield* Effect.gen(function* () {
        switch (insightId) {
          case "builtin/arr": {
            const mrr = yield* getSeries(
              "builtin/mrr",
              compiledFilter,
              granularity,
              timeRange,
              organizationId,
            );
            return mrr.map((point) => ({ ...point, value: point.value * 12 }));
          }
          case "builtin/mrr_growth_rate": {
            const mrr = yield* getSeries(
              "builtin/mrr",
              compiledFilter,
              granularity,
              timeRange,
              organizationId,
            );
            return mrr.map((point, index) => ({
              timestamp: point.timestamp,
              value: calculateGrowthRate(point.value, mrr[index - 1]?.value ?? 0),
            }));
          }
          case "builtin/churn_rate": {
            const [churned, active] = yield* Effect.all([
              getSeries(
                "builtin/churned_subscriptions",
                compiledFilter,
                granularity,
                timeRange,
                organizationId,
              ),
              getSeries(
                "builtin/active_subscriptions",
                compiledFilter,
                granularity,
                timeRange,
                organizationId,
              ),
            ]);
            return churned.map((point, index) => ({
              timestamp: point.timestamp,
              value: calculateRate(point.value, (active[index]?.value ?? 0) + point.value),
            }));
          }
          case "builtin/retention": {
            const [active, churned] = yield* Effect.all([
              getSeries(
                "builtin/active_subscriptions",
                compiledFilter,
                granularity,
                timeRange,
                organizationId,
              ),
              getSeries(
                "builtin/churned_subscriptions",
                compiledFilter,
                granularity,
                timeRange,
                organizationId,
              ),
            ]);
            return active.map((point, index) => ({
              timestamp: point.timestamp,
              value: calculateRate(point.value, point.value + (churned[index]?.value ?? 0)),
            }));
          }
          case "builtin/arpu": {
            const [revenue, persons] = yield* Effect.all([
              getSeries("builtin/revenue", compiledFilter, granularity, timeRange, organizationId),
              getSeries(
                "builtin/person_count",
                compiledFilter,
                granularity,
                timeRange,
                organizationId,
              ),
            ]);
            return revenue.map((point, index) => ({
              timestamp: point.timestamp,
              value: persons[index]?.value ? point.value / persons[index].value : 0,
            }));
          }
          case "builtin/arppu": {
            const [revenue, payingPersons] = yield* Effect.all([
              getSeries("builtin/revenue", compiledFilter, granularity, timeRange, organizationId),
              accessor.getPayingPersonCount({ filters: compiledFilter, organizationId, params }),
            ]);
            return revenue.map((point, index) => ({
              timestamp: point.timestamp,
              value: payingPersons[index]?.value ? point.value / payingPersons[index].value : 0,
            }));
          }
          case "builtin/active_subscribers_growth": {
            const activeSubscriptions = yield* getSeries(
              "builtin/active_subscriptions",
              compiledFilter,
              granularity,
              timeRange,
              organizationId,
            );
            return activeSubscriptions.map((point, index) => ({
              timestamp: point.timestamp,
              value: calculateGrowthRate(point.value, activeSubscriptions[index - 1]?.value ?? 0),
            }));
          }
          case "builtin/subscriber_lifetime_value": {
            const [arpu, churnRate] = yield* Effect.all([
              getSeries("builtin/arpu", compiledFilter, granularity, timeRange, organizationId),
              getSeries(
                "builtin/churn_rate",
                compiledFilter,
                granularity,
                timeRange,
                organizationId,
              ),
            ]);
            return arpu.map((point, index) => {
              const churnPercentage = churnRate[index]?.value ?? 0;
              return {
                timestamp: point.timestamp,
                value: churnPercentage > 0 ? point.value / (churnPercentage / 100) : 0,
              };
            });
          }
          case "builtin/trial_conversion_rate": {
            const [trials, conversions] = yield* Effect.all([
              getSeries("builtin/trials", compiledFilter, granularity, timeRange, organizationId),
              getSeries(
                "builtin/trial_conversions",
                compiledFilter,
                granularity,
                timeRange,
                organizationId,
              ),
            ]);
            return trials.map((point, index) => ({
              timestamp: point.timestamp,
              value: calculateRate(conversions[index]?.value ?? 0, point.value),
            }));
          }
          default:
            return yield* executePrimitiveMetric({
              accessor,
              compiledFilter,
              insightId,
              organizationId,
              params,
            });
        }
      });

      cache.set(cacheKey, series);
      return series;
    });

  return { getSeries };
};
