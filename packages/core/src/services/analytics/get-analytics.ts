import {
  AnalyticsServiceError,
  AuthSession,
  InvalidTimeRangeError,
} from "@voidhash/shared";
import { Effect } from "effect";

import { checkProjectPermission } from "../../utils/permissions";
import { createMySQLAccessor } from "./data-access/mysql-accessor";
import type {
  AnalyticsDataPoint,
  AnalyticsFilters,
  TimeGranularity,
  TimeRangeParams,
} from "./data-access/types";

type TimeRangeType =
  | "last_7d"
  | "last_30d"
  | "last_90d"
  | "last_365d"
  | "mtd"
  | "qtd"
  | "ytd"
  | "custom";

type MetricType =
  | "mrr"
  | "arr"
  | "revenue"
  | "churn_rate"
  | "customer_count"
  | "new_customers"
  | "retention"
  | "arpu"
  | "arppu"
  | "active_subscriptions"
  | "new_subscriptions"
  | "churned_subscriptions"
  | "trials"
  | "trial_conversions";

export interface AnalyticsInput {
  projectId: string;
  metrics: MetricType[];
  timeRange: TimeRangeType;
  granularity: TimeGranularity;
  startDate?: Date;
  endDate?: Date;
  compareToPreviousPeriod?: boolean;
  filters?: AnalyticsFilters;
}

interface MetricResult {
  metric: MetricType;
  currentValue: number;
  previousValue: number | null;
  percentChange: number | null;
  timeSeries: AnalyticsDataPoint[];
  currency?: string;
}

export interface AnalyticsResult {
  projectId: string;
  timeRange: { start: Date; end: Date };
  previousTimeRange: { start: Date; end: Date } | null;
  granularity: TimeGranularity;
  results: MetricResult[];
}

const resolveTimeRange = (
  timeRange: TimeRangeType,
  startDate?: Date,
  endDate?: Date
): Effect.Effect<{ start: Date; end: Date }, InvalidTimeRangeError> =>
  Effect.gen(function* resolveTimeRange() {
    const now = new Date();

    switch (timeRange) {
      case "last_7d": {
        return {
          end: now,
          start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        };
      }
      case "last_30d": {
        return {
          end: now,
          start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        };
      }
      case "last_90d": {
        return {
          end: now,
          start: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
        };
      }
      case "last_365d": {
        return {
          end: now,
          start: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
        };
      }
      case "mtd": {
        return {
          end: now,
          start: new Date(now.getFullYear(), now.getMonth(), 1),
        };
      }
      case "qtd": {
        const quarter = Math.floor(now.getMonth() / 3);
        return {
          end: now,
          start: new Date(now.getFullYear(), quarter * 3, 1),
        };
      }
      case "ytd": {
        return {
          end: now,
          start: new Date(now.getFullYear(), 0, 1),
        };
      }
      case "custom": {
        if (!(startDate && endDate)) {
          return yield* Effect.fail(
            new InvalidTimeRangeError({
              message: "Custom time range requires startDate and endDate",
            })
          );
        }
        if (startDate > endDate) {
          return yield* Effect.fail(
            new InvalidTimeRangeError({
              message: "startDate must be before endDate",
            })
          );
        }
        return { end: endDate, start: startDate };
      }
      default: {
        return yield* Effect.fail(
          new InvalidTimeRangeError({
            message: `Unknown time range: ${timeRange}`,
          })
        );
      }
    }
  });

const getPreviousPeriod = (start: Date, end: Date) => {
  const duration = end.getTime() - start.getTime();
  return {
    end: new Date(end.getTime() - duration),
    start: new Date(start.getTime() - duration),
  };
};

const calculatePercentChange = (
  current: number,
  previous: number
): number | null => {
  if (previous === 0) {
    return current > 0 ? 100 : null;
  }
  return ((current - previous) / previous) * 100;
};

const sumDataPoints = (dataPoints: AnalyticsDataPoint[]): number =>
  dataPoints.reduce((sum, dp) => sum + dp.value, 0);

const avgDataPoints = (dataPoints: AnalyticsDataPoint[]): number => {
  if (dataPoints.length === 0) {
    return 0;
  }
  return sumDataPoints(dataPoints) / dataPoints.length;
};

const REVENUE_METRICS = new Set<MetricType>([
  "revenue",
  "mrr",
  "arr",
  "arpu",
  "arppu",
]);

export const getAnalytics = Effect.gen(function* getAnalytics() {
  const accessor = yield* createMySQLAccessor;

  return Effect.fn("getAnalytics")(
    function* getAnalytics(input: AnalyticsInput) {
      const session = yield* AuthSession;

      yield* checkProjectPermission(
        input.projectId,
        "project:all",
        `User ${session?.user?.id} is not authorized to access analytics for project ${input.projectId}`
      );

      const timeRange = yield* resolveTimeRange(
        input.timeRange,
        input.startDate,
        input.endDate
      );

      const previousTimeRange = input.compareToPreviousPeriod
        ? getPreviousPeriod(timeRange.start, timeRange.end)
        : null;

      const params: TimeRangeParams = {
        endDate: timeRange.end,
        granularity: input.granularity,
        projectId: input.projectId,
        startDate: timeRange.start,
      };

      const previousParams = previousTimeRange
        ? {
            ...params,
            startDate: previousTimeRange.start,
            endDate: previousTimeRange.end,
          }
        : null;

      const metricResults = yield* Effect.all(
        input.metrics.map((metric) =>
          Effect.gen(function* metricResults() {
            let currentData: AnalyticsDataPoint[] = [];
            let previousData: AnalyticsDataPoint[] = [];

            switch (metric) {
              case "revenue": {
                currentData = yield* accessor.getRevenue({
                  filters: input.filters,
                  params,
                });
                if (previousParams) {
                  previousData = yield* accessor.getRevenue({
                    filters: input.filters,
                    params: previousParams,
                  });
                }
                break;
              }
              case "mrr": {
                currentData = yield* accessor.getMRR({
                  filters: input.filters,
                  params,
                });
                if (previousParams) {
                  previousData = yield* accessor.getMRR({
                    filters: input.filters,
                    params: previousParams,
                  });
                }
                break;
              }
              case "arr": {
                // ARR = MRR * 12
                currentData = yield* accessor.getMRR({
                  filters: input.filters,
                  params,
                });
                currentData = currentData.map((dp) => ({
                  ...dp,
                  value: dp.value * 12,
                }));
                if (previousParams) {
                  previousData = yield* accessor.getMRR({
                    filters: input.filters,
                    params: previousParams,
                  });
                  previousData = previousData.map((dp) => ({
                    ...dp,
                    value: dp.value * 12,
                  }));
                }
                break;
              }
              case "active_subscriptions": {
                currentData = yield* accessor.getActiveSubscriptions({
                  filters: input.filters,
                  params,
                });
                if (previousParams) {
                  previousData = yield* accessor.getActiveSubscriptions({
                    filters: input.filters,
                    params: previousParams,
                  });
                }
                break;
              }
              case "new_subscriptions": {
                currentData = yield* accessor.getNewSubscriptions({
                  filters: input.filters,
                  params,
                });
                if (previousParams) {
                  previousData = yield* accessor.getNewSubscriptions({
                    filters: input.filters,
                    params: previousParams,
                  });
                }
                break;
              }
              case "churned_subscriptions": {
                currentData = yield* accessor.getChurnedSubscriptions({
                  filters: input.filters,
                  params,
                });
                if (previousParams) {
                  previousData = yield* accessor.getChurnedSubscriptions({
                    filters: input.filters,
                    params: previousParams,
                  });
                }
                break;
              }
              case "churn_rate": {
                const [churned, active] = yield* Effect.all([
                  accessor.getChurnedSubscriptions({
                    filters: input.filters,
                    params,
                  }),
                  accessor.getActiveSubscriptions({
                    filters: input.filters,
                    params,
                  }),
                ]);
                // Churn rate = churned / (active + churned) * 100
                currentData = churned.map((c, i) => ({
                  timestamp: c.timestamp,
                  value:
                    active[i]?.value !== undefined
                      ? (c.value / (active[i].value + c.value)) * 100
                      : 0,
                }));
                if (previousParams) {
                  const [prevChurned, prevActive] = yield* Effect.all([
                    accessor.getChurnedSubscriptions({
                      filters: input.filters,
                      params: previousParams,
                    }),
                    accessor.getActiveSubscriptions({
                      filters: input.filters,
                      params: previousParams,
                    }),
                  ]);
                  previousData = prevChurned.map((c, i) => ({
                    timestamp: c.timestamp,
                    value:
                      prevActive[i]?.value !== undefined
                        ? (c.value / (prevActive[i].value + c.value)) * 100
                        : 0,
                  }));
                }
                break;
              }
              case "trials": {
                currentData = yield* accessor.getTrials({
                  filters: input.filters,
                  params,
                });
                if (previousParams) {
                  previousData = yield* accessor.getTrials({
                    filters: input.filters,
                    params: previousParams,
                  });
                }
                break;
              }
              case "trial_conversions": {
                currentData = yield* accessor.getTrialConversions({
                  filters: input.filters,
                  params,
                });
                if (previousParams) {
                  previousData = yield* accessor.getTrialConversions({
                    filters: input.filters,
                    params: previousParams,
                  });
                }
                break;
              }
              case "customer_count": {
                currentData = yield* accessor.getCustomerCount({
                  filters: input.filters,
                  params,
                });
                if (previousParams) {
                  previousData = yield* accessor.getCustomerCount({
                    filters: input.filters,
                    params: previousParams,
                  });
                }
                break;
              }
              case "new_customers": {
                currentData = yield* accessor.getNewCustomers({
                  filters: input.filters,
                  params,
                });
                if (previousParams) {
                  previousData = yield* accessor.getNewCustomers({
                    filters: input.filters,
                    params: previousParams,
                  });
                }
                break;
              }
              case "retention": {
                // Simplified retention: active / (active + churned) * 100
                const [active, churned] = yield* Effect.all([
                  accessor.getActiveSubscriptions({
                    filters: input.filters,
                    params,
                  }),
                  accessor.getChurnedSubscriptions({
                    filters: input.filters,
                    params,
                  }),
                ]);
                currentData = active.map((a, i) => ({
                  timestamp: a.timestamp,
                  value:
                    churned[i]?.value !== undefined
                      ? (a.value / (a.value + churned[i].value)) * 100
                      : 100,
                }));
                if (previousParams) {
                  const [prevActive, prevChurned] = yield* Effect.all([
                    accessor.getActiveSubscriptions({
                      filters: input.filters,
                      params: previousParams,
                    }),
                    accessor.getChurnedSubscriptions({
                      filters: input.filters,
                      params: previousParams,
                    }),
                  ]);
                  previousData = prevActive.map((a, i) => ({
                    timestamp: a.timestamp,
                    value:
                      prevChurned[i]?.value !== undefined
                        ? (a.value / (a.value + prevChurned[i].value)) * 100
                        : 100,
                  }));
                }
                break;
              }
              case "arpu": {
                const [revenue, customers] = yield* Effect.all([
                  accessor.getRevenue({ filters: input.filters, params }),
                  accessor.getCustomerCount({ filters: input.filters, params }),
                ]);
                currentData = revenue.map((r, i) => ({
                  timestamp: r.timestamp,
                  value: customers[i]?.value ? r.value / customers[i].value : 0,
                }));
                if (previousParams) {
                  const [prevRevenue, prevCustomers] = yield* Effect.all([
                    accessor.getRevenue({
                      filters: input.filters,
                      params: previousParams,
                    }),
                    accessor.getCustomerCount({
                      filters: input.filters,
                      params: previousParams,
                    }),
                  ]);
                  previousData = prevRevenue.map((r, i) => ({
                    timestamp: r.timestamp,
                    value: prevCustomers[i]?.value
                      ? r.value / prevCustomers[i].value
                      : 0,
                  }));
                }
                break;
              }
              case "arppu": {
                const [revenue, paying] = yield* Effect.all([
                  accessor.getRevenue({ filters: input.filters, params }),
                  accessor.getPayingCustomerCount({
                    filters: input.filters,
                    params,
                  }),
                ]);
                currentData = revenue.map((r, i) => ({
                  timestamp: r.timestamp,
                  value: paying[i]?.value ? r.value / paying[i].value : 0,
                }));
                if (previousParams) {
                  const [prevRevenue, prevPaying] = yield* Effect.all([
                    accessor.getRevenue({
                      filters: input.filters,
                      params: previousParams,
                    }),
                    accessor.getPayingCustomerCount({
                      filters: input.filters,
                      params: previousParams,
                    }),
                  ]);
                  previousData = prevRevenue.map((r, i) => ({
                    timestamp: r.timestamp,
                    value: prevPaying[i]?.value
                      ? r.value / prevPaying[i].value
                      : 0,
                  }));
                }
                break;
              }
            }

            // For rate-based metrics, use average; for counts/amounts, use sum
            const isRateMetric = ["churn_rate", "retention"].includes(metric);
            const currentValue = isRateMetric
              ? avgDataPoints(currentData)
              : sumDataPoints(currentData);
            const previousValue = previousParams
              ? (isRateMetric
                ? avgDataPoints(previousData)
                : sumDataPoints(previousData))
              : null;

            return {
              currency: REVENUE_METRICS.has(metric) ? "USD" : undefined,
              currentValue,
              metric,
              percentChange:
                previousValue !== null
                  ? calculatePercentChange(currentValue, previousValue)
                  : null,
              previousValue,
              timeSeries: currentData,
            } satisfies MetricResult;
          })
        ),
        { concurrency: 5 }
      );

      return {
        granularity: input.granularity,
        previousTimeRange: previousTimeRange
          ? {
              end: previousTimeRange.end,
              start: previousTimeRange.start,
            }
          : null,
        projectId: input.projectId,
        results: metricResults,
        timeRange: {
          end: timeRange.end,
          start: timeRange.start,
        },
      };
    },
    (effect) =>
      effect.pipe(
        Effect.catchTags({
          DatabaseError: (error) =>
            new AnalyticsServiceError({
              cause: String(error.cause),
            }),
        })
      )
  );
});
