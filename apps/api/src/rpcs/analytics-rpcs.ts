import type { AnalyticsFilters } from "@voidhash/core/services";
import { AnalyticsService } from "@voidhash/core/services";
import { AnalyticsRpcsDef } from "@voidhash/rpc";
import { Effect, Layer } from "effect";

const ALL_METRICS = [
  "mrr",
  "arr",
  "revenue",
  "churn_rate",
  "customer_count",
  "new_customers",
  "retention",
  "arpu",
  "arppu",
  "active_subscriptions",
  "new_subscriptions",
  "churned_subscriptions",
  "trials",
  "trial_conversions",
] as const;

type MetricType = (typeof ALL_METRICS)[number];

export const AnalyticsRpcsLive = AnalyticsRpcsDef.toLayer(
  Effect.gen(function* AnalyticsRpcsLive() {
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
        filters,
      }) =>
        analyticsService.getAnalytics({
          compareToPreviousPeriod: compareToPreviousPeriod ?? false,
          endDate,
          filters: filters
            ? ({
                productIds: filters.productIds
                  ? [...filters.productIds]
                  : undefined,
                providerEnvironment: filters.providerEnvironment,
                subscriptionStatuses: filters.subscriptionStatuses
                  ? [...filters.subscriptionStatuses]
                  : undefined,
              } satisfies AnalyticsFilters)
            : undefined,
          granularity,
          metrics: [...metrics] as MetricType[],
          projectId,
          startDate,
          timeRange,
        }),

      GetDashboardOverview: ({ projectId, timeRange, startDate, endDate }) =>
        analyticsService.getAnalytics({
          compareToPreviousPeriod: true,
          endDate,
          granularity: "day",
          metrics: [...ALL_METRICS] as MetricType[],
          projectId,
          startDate,
          timeRange,
        }),
    };
  })
).pipe(Layer.provide(AnalyticsService.Default));
