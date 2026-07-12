import { Rpc, RpcGroup } from "effect/unstable/rpc";
import { Schema } from "effect";

import {
  RpcAnalyticsServiceError,
  RpcInvalidAnalyticsQueryError,
  RpcInvalidTimeRangeError,
  RpcUnknownInsightError,
  RpcUnsupportedAnalyticsBreakdownError,
  RpcUnsupportedAnalyticsFilterError,
} from "../errors/analytics.ts";
import { RpcActionForbiddenError } from "../errors/common.ts";
import { AuthMiddleware } from "../middlewares.ts";

export const AnalyticsContext = Schema.Struct({
  organizationId: Schema.String,
});
export type AnalyticsContextType = typeof AnalyticsContext.Type;

export const AnalyticsGranularity = Schema.Union([
  Schema.Literal("hour"),
  Schema.Literal("day"),
  Schema.Literal("week"),
  Schema.Literal("month"),
  Schema.Literal("quarter"),
  Schema.Literal("year"),
]);
export type AnalyticsGranularityType = typeof AnalyticsGranularity.Type;

export const AnalyticsTimeRangePreset = Schema.Union([
  Schema.Literal("today"),
  Schema.Literal("last_7d"),
  Schema.Literal("last_30d"),
  Schema.Literal("last_90d"),
  Schema.Literal("last_365d"),
  Schema.Literal("mtd"),
  Schema.Literal("qtd"),
  Schema.Literal("ytd"),
]);

export const AnalyticsTimeRange = Schema.Union([
  Schema.Struct({
    preset: AnalyticsTimeRangePreset,
  }),
  Schema.Struct({
    end: Schema.Date,
    preset: Schema.Literal("custom"),
    start: Schema.Date,
  }),
]);
export type AnalyticsTimeRangeType = typeof AnalyticsTimeRange.Type;

export const AnalyticsFieldRef = Schema.String;
export type AnalyticsFieldRefType = typeof AnalyticsFieldRef.Type;

const AnalyticsFieldValuePrimitive = Schema.Union([
  Schema.String,
  Schema.Finite,
  Schema.Boolean,
  Schema.Null,
]);

export const AnalyticsFieldValue = Schema.Union([
  AnalyticsFieldValuePrimitive,
  Schema.Array(AnalyticsFieldValuePrimitive),
]);
export type AnalyticsFieldValueType = typeof AnalyticsFieldValue.Type;

export const AnalyticsFilterPredicate = Schema.Struct({
  field: AnalyticsFieldRef,
  op: Schema.Union([
    Schema.Literal("eq"),
    Schema.Literal("neq"),
    Schema.Literal("in"),
    Schema.Literal("not_in"),
    Schema.Literal("gt"),
    Schema.Literal("gte"),
    Schema.Literal("lt"),
    Schema.Literal("lte"),
    Schema.Literal("contains"),
    Schema.Literal("exists"),
  ]),
  type: Schema.Literal("predicate"),
  value: Schema.optional(AnalyticsFieldValue),
});

export type AnalyticsFilterType =
  | typeof AnalyticsFilterPredicate.Type
  | {
      readonly filters: ReadonlyArray<AnalyticsFilterType>;
      readonly type: "and" | "or";
    }
  | {
      readonly filter: AnalyticsFilterType;
      readonly type: "not";
    };

// `Schema.Schema<T>` extends `Top` which has `unknown` for `DecodingServices`
// and `EncodingServices`. Annotating with `Schema.Codec<T, T, never, never>`
// keeps those service requirements as `never` so they don't pollute callers.
type AnalyticsFilterCodec = Schema.Codec<AnalyticsFilterType, AnalyticsFilterType, never, never>;

export const AnalyticsFilter: AnalyticsFilterCodec = Schema.Union([
  AnalyticsFilterPredicate,
  Schema.Struct({
    filters: Schema.Array(Schema.suspend((): AnalyticsFilterCodec => AnalyticsFilter)),
    type: Schema.Literal("and"),
  }),
  Schema.Struct({
    filters: Schema.Array(Schema.suspend((): AnalyticsFilterCodec => AnalyticsFilter)),
    type: Schema.Literal("or"),
  }),
  Schema.Struct({
    filter: Schema.suspend((): AnalyticsFilterCodec => AnalyticsFilter),
    type: Schema.Literal("not"),
  }),
]);

export const AnalyticsBreakdown = Schema.Struct({
  field: AnalyticsFieldRef,
  limit: Schema.optional(Schema.Number),
  order: Schema.optional(Schema.Union([Schema.Literal("asc"), Schema.Literal("desc")])),
});
export type AnalyticsBreakdownType = typeof AnalyticsBreakdown.Type;

export const BuiltInInsightId = Schema.Union([
  Schema.Literal("builtin/revenue"),
  Schema.Literal("builtin/mrr"),
  Schema.Literal("builtin/arr"),
  Schema.Literal("builtin/mrr_growth_rate"),
  Schema.Literal("builtin/churn_rate"),
  Schema.Literal("builtin/churned_revenue"),
  Schema.Literal("builtin/person_count"),
  Schema.Literal("builtin/new_persons"),
  Schema.Literal("builtin/retention"),
  Schema.Literal("builtin/arpu"),
  Schema.Literal("builtin/arppu"),
  Schema.Literal("builtin/active_subscriptions"),
  Schema.Literal("builtin/active_trials"),
  Schema.Literal("builtin/active_subscribers_growth"),
  Schema.Literal("builtin/new_subscriptions"),
  Schema.Literal("builtin/churned_subscriptions"),
  Schema.Literal("builtin/subscriber_lifetime_value"),
  Schema.Literal("builtin/trials"),
  Schema.Literal("builtin/trial_conversions"),
  Schema.Literal("builtin/trial_conversion_rate"),
]);
export type BuiltInInsightIdType = typeof BuiltInInsightId.Type;

export const AnalyticsInsightQuery = Schema.Struct({
  breakdowns: Schema.optional(Schema.Array(AnalyticsBreakdown)),
  context: AnalyticsContext,
  filter: Schema.optional(AnalyticsFilter),
  granularity: Schema.optional(AnalyticsGranularity),
  insightId: BuiltInInsightId,
  key: Schema.String,
  limit: Schema.optional(Schema.Number),
  timeRange: AnalyticsTimeRange,
});
export type AnalyticsInsightQueryType = typeof AnalyticsInsightQuery.Type;

export const QueryAnalyticsInsightsRequest = Schema.Struct({
  queries: Schema.NonEmptyArray(AnalyticsInsightQuery),
});
export type QueryAnalyticsInsightsRequestType = typeof QueryAnalyticsInsightsRequest.Type;

export const AnalyticsDataPoint = Schema.Struct({
  timestamp: Schema.Date,
  value: Schema.Number,
});
export type AnalyticsDataPointType = typeof AnalyticsDataPoint.Type;

export const AnalyticsSummary = Schema.Struct({
  currency: Schema.optional(Schema.String),
  value: Schema.Number,
});
export type AnalyticsSummaryType = typeof AnalyticsSummary.Type;

export const AnalyticsMetricResult = Schema.Struct({
  kind: Schema.Literal("metric"),
  sparkline: Schema.Array(AnalyticsDataPoint),
  summary: AnalyticsSummary,
});

export const AnalyticsTimeseriesResult = Schema.Struct({
  kind: Schema.Literal("timeseries"),
  series: Schema.Array(AnalyticsDataPoint),
  summary: AnalyticsSummary,
});

export const AnalyticsBreakdownRow = Schema.Struct({
  key: Schema.String,
  label: Schema.String,
  value: Schema.Number,
});

export const AnalyticsBreakdownResult = Schema.Struct({
  kind: Schema.Literal("breakdown"),
  rows: Schema.Array(AnalyticsBreakdownRow),
  summary: Schema.optional(AnalyticsSummary),
});

export const AnalyticsInsightResult = Schema.Union([
  AnalyticsMetricResult,
  AnalyticsTimeseriesResult,
  AnalyticsBreakdownResult,
]);
export type AnalyticsInsightResultType = typeof AnalyticsInsightResult.Type;

export const AnalyticsInsightResponseItem = Schema.Struct({
  insightId: BuiltInInsightId,
  key: Schema.String,
  resolvedTimeRange: Schema.Struct({
    end: Schema.Date,
    start: Schema.Date,
  }),
  result: AnalyticsInsightResult,
});
export type AnalyticsInsightResponseItemType = typeof AnalyticsInsightResponseItem.Type;

export const QueryAnalyticsInsightsResponse = Schema.Struct({
  results: Schema.Array(AnalyticsInsightResponseItem),
});
export type QueryAnalyticsInsightsResponseType = typeof QueryAnalyticsInsightsResponse.Type;

export const RecentAnalyticsEvent = Schema.Struct({
  captureId: Schema.String,
  context: Schema.Record(Schema.String, Schema.Unknown),
  eventId: Schema.String,
  eventName: Schema.String,
  identityMode: Schema.String,
  personDistinctId: Schema.NullOr(Schema.String),
  personEmail: Schema.NullOr(Schema.String),
  personId: Schema.NullOr(Schema.String),
  personName: Schema.NullOr(Schema.String),
  previousDistinctId: Schema.NullOr(Schema.String),
  processedAt: Schema.Date,
  properties: Schema.Record(Schema.String, Schema.Unknown),
  receivedAt: Schema.Date,
  requestId: Schema.String,
});
export type RecentAnalyticsEventType = typeof RecentAnalyticsEvent.Type;

export const ListRecentAnalyticsEventsRequest = Schema.Struct({
  limit: Schema.optional(Schema.Number),
  projectId: Schema.String,
});
export type ListRecentAnalyticsEventsRequestType = typeof ListRecentAnalyticsEventsRequest.Type;

export const ListRecentAnalyticsEventsResponse = Schema.Struct({
  events: Schema.Array(RecentAnalyticsEvent),
  hasMore: Schema.Boolean,
});
export type ListRecentAnalyticsEventsResponseType = typeof ListRecentAnalyticsEventsResponse.Type;

export class AnalyticsRpcsDef extends RpcGroup.make(
  Rpc.make("ListRecentAnalyticsEvents", {
    error: Schema.Union([RpcActionForbiddenError, RpcAnalyticsServiceError]),
    payload: ListRecentAnalyticsEventsRequest,
    success: ListRecentAnalyticsEventsResponse,
  }),
  Rpc.make("QueryAnalyticsInsights", {
    error: Schema.Union([
      RpcActionForbiddenError,
      RpcAnalyticsServiceError,
      RpcInvalidAnalyticsQueryError,
      RpcInvalidTimeRangeError,
      RpcUnknownInsightError,
      RpcUnsupportedAnalyticsBreakdownError,
      RpcUnsupportedAnalyticsFilterError,
    ]),
    payload: QueryAnalyticsInsightsRequest,
    success: QueryAnalyticsInsightsResponse,
  }),
).middleware(AuthMiddleware) {}
