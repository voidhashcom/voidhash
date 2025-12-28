import {
  AnalyticsServiceError,
  AuthSession,
  InvalidTimeRangeError
} from '@voidhash/shared';
import { Effect } from 'effect';
import { checkProjectPermission } from '../../utils/permissions';
import { createMySQLAccessor } from './data-access/mysql-accessor';
import type {
  AnalyticsDataPoint,
  AnalyticsFilters,
  TimeGranularity,
  TimeRangeParams
} from './data-access/types';

type TimeRangeType =
  | 'last_7d'
  | 'last_30d'
  | 'last_90d'
  | 'last_365d'
  | 'mtd'
  | 'qtd'
  | 'ytd'
  | 'custom';

type MetricType =
  | 'mrr'
  | 'arr'
  | 'revenue'
  | 'churn_rate'
  | 'customer_count'
  | 'new_customers'
  | 'retention'
  | 'arpu'
  | 'arppu'
  | 'active_subscriptions'
  | 'new_subscriptions'
  | 'churned_subscriptions'
  | 'trials'
  | 'trial_conversions';

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
  Effect.gen(function* () {
    const now = new Date();

    switch (timeRange) {
      case 'last_7d':
        return {
          start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          end: now
        };
      case 'last_30d':
        return {
          start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          end: now
        };
      case 'last_90d':
        return {
          start: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
          end: now
        };
      case 'last_365d':
        return {
          start: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
          end: now
        };
      case 'mtd': {
        return {
          start: new Date(now.getFullYear(), now.getMonth(), 1),
          end: now
        };
      }
      case 'qtd': {
        const quarter = Math.floor(now.getMonth() / 3);
        return {
          start: new Date(now.getFullYear(), quarter * 3, 1),
          end: now
        };
      }
      case 'ytd':
        return {
          start: new Date(now.getFullYear(), 0, 1),
          end: now
        };
      case 'custom':
        if (!(startDate && endDate)) {
          return yield* Effect.fail(
            new InvalidTimeRangeError({
              message: 'Custom time range requires startDate and endDate'
            })
          );
        }
        if (startDate > endDate) {
          return yield* Effect.fail(
            new InvalidTimeRangeError({
              message: 'startDate must be before endDate'
            })
          );
        }
        return { start: startDate, end: endDate };
      default:
        return yield* Effect.fail(
          new InvalidTimeRangeError({
            message: `Unknown time range: ${timeRange}`
          })
        );
    }
  });

const getPreviousPeriod = (start: Date, end: Date) => {
  const duration = end.getTime() - start.getTime();
  return {
    start: new Date(start.getTime() - duration),
    end: new Date(end.getTime() - duration)
  };
};

const calculatePercentChange = (
  current: number,
  previous: number
): number | null => {
  if (previous === 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
};

const sumDataPoints = (dataPoints: AnalyticsDataPoint[]): number =>
  dataPoints.reduce((sum, dp) => sum + dp.value, 0);

const avgDataPoints = (dataPoints: AnalyticsDataPoint[]): number => {
  if (dataPoints.length === 0) return 0;
  return sumDataPoints(dataPoints) / dataPoints.length;
};

const REVENUE_METRICS: MetricType[] = [
  'revenue',
  'mrr',
  'arr',
  'arpu',
  'arppu'
];

export const getAnalytics = Effect.gen(function* () {
  const accessor = yield* createMySQLAccessor;

  return Effect.fn('getAnalytics')(
    function* (input: AnalyticsInput) {
      const session = yield* AuthSession;

      yield* checkProjectPermission(
        input.projectId,
        'project:all',
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
        projectId: input.projectId,
        startDate: timeRange.start,
        endDate: timeRange.end,
        granularity: input.granularity
      };

      const previousParams = previousTimeRange
        ? {
            ...params,
            startDate: previousTimeRange.start,
            endDate: previousTimeRange.end
          }
        : null;

      const metricResults = yield* Effect.all(
        input.metrics.map((metric) =>
          Effect.gen(function* () {
            let currentData: AnalyticsDataPoint[] = [];
            let previousData: AnalyticsDataPoint[] = [];

            switch (metric) {
              case 'revenue': {
                currentData = yield* accessor.getRevenue({
                  params,
                  filters: input.filters
                });
                if (previousParams) {
                  previousData = yield* accessor.getRevenue({
                    params: previousParams,
                    filters: input.filters
                  });
                }
                break;
              }
              case 'mrr': {
                currentData = yield* accessor.getMRR({
                  params,
                  filters: input.filters
                });
                if (previousParams) {
                  previousData = yield* accessor.getMRR({
                    params: previousParams,
                    filters: input.filters
                  });
                }
                break;
              }
              case 'arr': {
                // ARR = MRR * 12
                currentData = yield* accessor.getMRR({
                  params,
                  filters: input.filters
                });
                currentData = currentData.map((dp) => ({
                  ...dp,
                  value: dp.value * 12
                }));
                if (previousParams) {
                  previousData = yield* accessor.getMRR({
                    params: previousParams,
                    filters: input.filters
                  });
                  previousData = previousData.map((dp) => ({
                    ...dp,
                    value: dp.value * 12
                  }));
                }
                break;
              }
              case 'active_subscriptions': {
                currentData = yield* accessor.getActiveSubscriptions({
                  params,
                  filters: input.filters
                });
                if (previousParams) {
                  previousData = yield* accessor.getActiveSubscriptions({
                    params: previousParams,
                    filters: input.filters
                  });
                }
                break;
              }
              case 'new_subscriptions': {
                currentData = yield* accessor.getNewSubscriptions({
                  params,
                  filters: input.filters
                });
                if (previousParams) {
                  previousData = yield* accessor.getNewSubscriptions({
                    params: previousParams,
                    filters: input.filters
                  });
                }
                break;
              }
              case 'churned_subscriptions': {
                currentData = yield* accessor.getChurnedSubscriptions({
                  params,
                  filters: input.filters
                });
                if (previousParams) {
                  previousData = yield* accessor.getChurnedSubscriptions({
                    params: previousParams,
                    filters: input.filters
                  });
                }
                break;
              }
              case 'churn_rate': {
                const [churned, active] = yield* Effect.all([
                  accessor.getChurnedSubscriptions({
                    params,
                    filters: input.filters
                  }),
                  accessor.getActiveSubscriptions({
                    params,
                    filters: input.filters
                  })
                ]);
                // Churn rate = churned / (active + churned) * 100
                currentData = churned.map((c, i) => ({
                  timestamp: c.timestamp,
                  value:
                    active[i]?.value !== undefined
                      ? (c.value / (active[i].value + c.value)) * 100
                      : 0
                }));
                if (previousParams) {
                  const [prevChurned, prevActive] = yield* Effect.all([
                    accessor.getChurnedSubscriptions({
                      params: previousParams,
                      filters: input.filters
                    }),
                    accessor.getActiveSubscriptions({
                      params: previousParams,
                      filters: input.filters
                    })
                  ]);
                  previousData = prevChurned.map((c, i) => ({
                    timestamp: c.timestamp,
                    value:
                      prevActive[i]?.value !== undefined
                        ? (c.value / (prevActive[i].value + c.value)) * 100
                        : 0
                  }));
                }
                break;
              }
              case 'trials': {
                currentData = yield* accessor.getTrials({
                  params,
                  filters: input.filters
                });
                if (previousParams) {
                  previousData = yield* accessor.getTrials({
                    params: previousParams,
                    filters: input.filters
                  });
                }
                break;
              }
              case 'trial_conversions': {
                currentData = yield* accessor.getTrialConversions({
                  params,
                  filters: input.filters
                });
                if (previousParams) {
                  previousData = yield* accessor.getTrialConversions({
                    params: previousParams,
                    filters: input.filters
                  });
                }
                break;
              }
              case 'customer_count': {
                currentData = yield* accessor.getCustomerCount({
                  params,
                  filters: input.filters
                });
                if (previousParams) {
                  previousData = yield* accessor.getCustomerCount({
                    params: previousParams,
                    filters: input.filters
                  });
                }
                break;
              }
              case 'new_customers': {
                currentData = yield* accessor.getNewCustomers({
                  params,
                  filters: input.filters
                });
                if (previousParams) {
                  previousData = yield* accessor.getNewCustomers({
                    params: previousParams,
                    filters: input.filters
                  });
                }
                break;
              }
              case 'retention': {
                // Simplified retention: active / (active + churned) * 100
                const [active, churned] = yield* Effect.all([
                  accessor.getActiveSubscriptions({
                    params,
                    filters: input.filters
                  }),
                  accessor.getChurnedSubscriptions({
                    params,
                    filters: input.filters
                  })
                ]);
                currentData = active.map((a, i) => ({
                  timestamp: a.timestamp,
                  value:
                    churned[i]?.value !== undefined
                      ? (a.value / (a.value + churned[i].value)) * 100
                      : 100
                }));
                if (previousParams) {
                  const [prevActive, prevChurned] = yield* Effect.all([
                    accessor.getActiveSubscriptions({
                      params: previousParams,
                      filters: input.filters
                    }),
                    accessor.getChurnedSubscriptions({
                      params: previousParams,
                      filters: input.filters
                    })
                  ]);
                  previousData = prevActive.map((a, i) => ({
                    timestamp: a.timestamp,
                    value:
                      prevChurned[i]?.value !== undefined
                        ? (a.value / (a.value + prevChurned[i].value)) * 100
                        : 100
                  }));
                }
                break;
              }
              case 'arpu': {
                const [revenue, customers] = yield* Effect.all([
                  accessor.getRevenue({ params, filters: input.filters }),
                  accessor.getCustomerCount({ params, filters: input.filters })
                ]);
                currentData = revenue.map((r, i) => ({
                  timestamp: r.timestamp,
                  value: customers[i]?.value ? r.value / customers[i].value : 0
                }));
                if (previousParams) {
                  const [prevRevenue, prevCustomers] = yield* Effect.all([
                    accessor.getRevenue({
                      params: previousParams,
                      filters: input.filters
                    }),
                    accessor.getCustomerCount({
                      params: previousParams,
                      filters: input.filters
                    })
                  ]);
                  previousData = prevRevenue.map((r, i) => ({
                    timestamp: r.timestamp,
                    value: prevCustomers[i]?.value
                      ? r.value / prevCustomers[i].value
                      : 0
                  }));
                }
                break;
              }
              case 'arppu': {
                const [revenue, paying] = yield* Effect.all([
                  accessor.getRevenue({ params, filters: input.filters }),
                  accessor.getPayingCustomerCount({
                    params,
                    filters: input.filters
                  })
                ]);
                currentData = revenue.map((r, i) => ({
                  timestamp: r.timestamp,
                  value: paying[i]?.value ? r.value / paying[i].value : 0
                }));
                if (previousParams) {
                  const [prevRevenue, prevPaying] = yield* Effect.all([
                    accessor.getRevenue({
                      params: previousParams,
                      filters: input.filters
                    }),
                    accessor.getPayingCustomerCount({
                      params: previousParams,
                      filters: input.filters
                    })
                  ]);
                  previousData = prevRevenue.map((r, i) => ({
                    timestamp: r.timestamp,
                    value: prevPaying[i]?.value
                      ? r.value / prevPaying[i].value
                      : 0
                  }));
                }
                break;
              }
            }

            // For rate-based metrics, use average; for counts/amounts, use sum
            const isRateMetric = ['churn_rate', 'retention'].includes(metric);
            const currentValue = isRateMetric
              ? avgDataPoints(currentData)
              : sumDataPoints(currentData);
            const previousValue = previousParams
              ? isRateMetric
                ? avgDataPoints(previousData)
                : sumDataPoints(previousData)
              : null;

            return {
              metric,
              currentValue,
              previousValue,
              percentChange:
                previousValue !== null
                  ? calculatePercentChange(currentValue, previousValue)
                  : null,
              timeSeries: currentData,
              currency: REVENUE_METRICS.includes(metric) ? 'USD' : undefined
            } satisfies MetricResult;
          })
        ),
        { concurrency: 5 }
      );

      return {
        projectId: input.projectId,
        timeRange: {
          start: timeRange.start,
          end: timeRange.end
        },
        previousTimeRange: previousTimeRange
          ? {
              start: previousTimeRange.start,
              end: previousTimeRange.end
            }
          : null,
        granularity: input.granularity,
        results: metricResults
      };
    },
    (effect) =>
      effect.pipe(
        Effect.catchTags({
          DatabaseError: (error) =>
            new AnalyticsServiceError({
              cause: String(error.cause)
            })
        })
      )
  );
});
