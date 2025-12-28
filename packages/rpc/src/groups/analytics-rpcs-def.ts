import { Rpc, RpcGroup } from '@effect/rpc';
import {
  ActionForbiddenError,
  AnalyticsServiceError,
  InvalidMetricError,
  InvalidTimeRangeError
} from '@voidhash/shared';
import { Schema } from 'effect';
import { AuthMiddleware } from '../middlewares';

// ============================================
// Metric Enums
// ============================================
export const AnalyticsMetric = Schema.Literal(
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
);
export type AnalyticsMetricType = typeof AnalyticsMetric.Type;

export const TimeGranularity = Schema.Literal(
  'hour',
  'day',
  'week',
  'month',
  'quarter',
  'year'
);
export type TimeGranularityType = typeof TimeGranularity.Type;

export const TimeRange = Schema.Literal(
  'last_7d',
  'last_30d',
  'last_90d',
  'last_365d',
  'mtd', // Month to date
  'qtd', // Quarter to date
  'ytd', // Year to date
  'custom'
);
export type TimeRangeType = typeof TimeRange.Type;

// ============================================
// Request/Response Schemas
// ============================================
export const TimeSeriesDataPoint = Schema.Struct({
  timestamp: Schema.Date,
  value: Schema.Number
});

export const MetricResult = Schema.Struct({
  metric: AnalyticsMetric,
  currentValue: Schema.Number,
  previousValue: Schema.NullOr(Schema.Number),
  percentChange: Schema.NullOr(Schema.Number),
  timeSeries: Schema.Array(TimeSeriesDataPoint),
  currency: Schema.optional(Schema.String)
});

export const AnalyticsFilters = Schema.Struct({
  productIds: Schema.optional(Schema.Array(Schema.String)),
  subscriptionStatuses: Schema.optional(Schema.Array(Schema.Number)),
  providerEnvironment: Schema.optional(Schema.Number)
});

export const AnalyticsRequest = Schema.Struct({
  projectId: Schema.String,
  metrics: Schema.Array(AnalyticsMetric),
  timeRange: TimeRange,
  granularity: TimeGranularity,
  startDate: Schema.optional(Schema.Date),
  endDate: Schema.optional(Schema.Date),
  compareToPreviousPeriod: Schema.optional(Schema.Boolean),
  filters: Schema.optional(AnalyticsFilters)
});

export const AnalyticsResponse = Schema.Struct({
  projectId: Schema.String,
  timeRange: Schema.Struct({
    start: Schema.Date,
    end: Schema.Date
  }),
  previousTimeRange: Schema.NullOr(
    Schema.Struct({
      start: Schema.Date,
      end: Schema.Date
    })
  ),
  granularity: TimeGranularity,
  results: Schema.Array(MetricResult)
});

// ============================================
// RPC Group Definition
// ============================================
export class AnalyticsRpcsDef extends RpcGroup.make(
  Rpc.make('GetAnalytics', {
    success: AnalyticsResponse,
    payload: AnalyticsRequest,
    error: Schema.Union(
      ActionForbiddenError,
      AnalyticsServiceError,
      InvalidTimeRangeError,
      InvalidMetricError
    )
  }),
  Rpc.make('GetDashboardOverview', {
    success: AnalyticsResponse,
    payload: {
      projectId: Schema.String,
      timeRange: TimeRange,
      startDate: Schema.optional(Schema.Date),
      endDate: Schema.optional(Schema.Date)
    },
    error: Schema.Union(
      ActionForbiddenError,
      AnalyticsServiceError,
      InvalidTimeRangeError
    )
  })
).middleware(AuthMiddleware) {}
