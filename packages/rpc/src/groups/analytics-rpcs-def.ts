import { Rpc, RpcGroup } from "@effect/rpc";
import {
  ActionForbiddenError,
  AnalyticsServiceError,
  InvalidMetricError,
  InvalidTimeRangeError,
} from "@voidhash/shared";
import { Schema } from "effect";

import { AuthMiddleware } from "../middlewares";

// ============================================
// Metric Enums
// ============================================
export const AnalyticsMetric = Schema.Literal(
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
  "trial_conversions"
);
export type AnalyticsMetricType = typeof AnalyticsMetric.Type;

export const TimeGranularity = Schema.Literal(
  "hour",
  "day",
  "week",
  "month",
  "quarter",
  "year"
);
export type TimeGranularityType = typeof TimeGranularity.Type;

export const TimeRange = Schema.Literal(
  "last_7d",
  "last_30d",
  "last_90d",
  "last_365d",
  "mtd", // Month to date
  "qtd", // Quarter to date
  "ytd", // Year to date
  "custom"
);
export type TimeRangeType = typeof TimeRange.Type;

// ============================================
// Request/Response Schemas
// ============================================
export const TimeSeriesDataPoint = Schema.Struct({
  timestamp: Schema.Date,
  value: Schema.Number,
});

export const MetricResult = Schema.Struct({
  currency: Schema.optional(Schema.String),
  currentValue: Schema.Number,
  metric: AnalyticsMetric,
  percentChange: Schema.NullOr(Schema.Number),
  previousValue: Schema.NullOr(Schema.Number),
  timeSeries: Schema.Array(TimeSeriesDataPoint),
});

export const AnalyticsFilters = Schema.Struct({
  productIds: Schema.optional(Schema.Array(Schema.String)),
  providerEnvironment: Schema.optional(Schema.Number),
  subscriptionStatuses: Schema.optional(Schema.Array(Schema.Number)),
});

export const AnalyticsRequest = Schema.Struct({
  compareToPreviousPeriod: Schema.optional(Schema.Boolean),
  endDate: Schema.optional(Schema.Date),
  filters: Schema.optional(AnalyticsFilters),
  granularity: TimeGranularity,
  metrics: Schema.Array(AnalyticsMetric),
  projectId: Schema.String,
  startDate: Schema.optional(Schema.Date),
  timeRange: TimeRange,
});

export const AnalyticsResponse = Schema.Struct({
  granularity: TimeGranularity,
  previousTimeRange: Schema.NullOr(
    Schema.Struct({
      end: Schema.Date,
      start: Schema.Date,
    })
  ),
  projectId: Schema.String,
  results: Schema.Array(MetricResult),
  timeRange: Schema.Struct({
    end: Schema.Date,
    start: Schema.Date,
  }),
});

// ============================================
// RPC Group Definition
// ============================================
export class AnalyticsRpcsDef extends RpcGroup.make(
  Rpc.make("GetAnalytics", {
    error: Schema.Union(
      ActionForbiddenError,
      AnalyticsServiceError,
      InvalidTimeRangeError,
      InvalidMetricError
    ),
    payload: AnalyticsRequest,
    success: AnalyticsResponse,
  }),
  Rpc.make("GetDashboardOverview", {
    error: Schema.Union(
      ActionForbiddenError,
      AnalyticsServiceError,
      InvalidTimeRangeError
    ),
    payload: {
      endDate: Schema.optional(Schema.Date),
      projectId: Schema.String,
      startDate: Schema.optional(Schema.Date),
      timeRange: TimeRange,
    },
    success: AnalyticsResponse,
  })
).middleware(AuthMiddleware) {}
