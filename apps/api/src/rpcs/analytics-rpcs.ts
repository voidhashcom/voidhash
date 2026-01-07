import { AnalyticsService } from '@voidhash/core/services';
import type { AnalyticsFilters } from '@voidhash/core/services';
import { AnalyticsRpcsDef } from '@voidhash/rpc';
import { Effect, Layer } from 'effect';

const ALL_METRICS = [
  'mrr',
  'arr',
  'revenue',
  'churn_rate',
  'customer_count',
  'new_customers',
  'retention',
  'arpu',
  'arppu',
  'active_subscriptions',
  'new_subscriptions',
  'churned_subscriptions',
  'trials',
  'trial_conversions'
] as const;

type MetricType = (typeof ALL_METRICS)[number];

export const AnalyticsRpcsLive = AnalyticsRpcsDef.toLayer(
  Effect.gen(function* () {
    const analyticsService = yield* AnalyticsService;

    return {
      GetAnalytics: ({
        projectId,
        metrics,
        timeRange,
        granularity,
        startDate,
        endDate,
        compareToPreviousPeriod,
        filters
      }) =>
        analyticsService.getAnalytics({
          projectId,
          metrics: [...metrics] as MetricType[],
          timeRange,
          granularity,
          startDate,
          endDate,
          compareToPreviousPeriod: compareToPreviousPeriod ?? false,
          filters: filters
            ? ({
                productIds: filters.productIds
                  ? [...filters.productIds]
                  : undefined,
                subscriptionStatuses: filters.subscriptionStatuses
                  ? [...filters.subscriptionStatuses]
                  : undefined,
                providerEnvironment: filters.providerEnvironment
              } satisfies AnalyticsFilters)
            : undefined
        }),

      GetDashboardOverview: ({ projectId, timeRange, startDate, endDate }) =>
        analyticsService.getAnalytics({
          projectId,
          metrics: [...ALL_METRICS] as MetricType[],
          timeRange,
          granularity: 'day',
          startDate,
          endDate,
          compareToPreviousPeriod: true
        })
    };
  })
).pipe(Layer.provide(AnalyticsService.Default));
