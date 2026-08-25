import { Schema } from "effect";

import { PageParams } from "../Pagination.ts";

// ========================================================
// Query building blocks
// ========================================================

/** Bucket width a timeseries/metric insight is resolved at. */
export const AnalyticsGranularity = Schema.Union([
  Schema.Literal("hour"),
  Schema.Literal("day"),
  Schema.Literal("week"),
  Schema.Literal("month"),
  Schema.Literal("quarter"),
  Schema.Literal("year"),
]);

/** Rolling windows the server resolves against its own clock. */
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

/**
 * Either a named rolling window or an explicit `[start, end]`. The resolved
 * absolute range is echoed back on every result so a caller never has to
 * reimplement the preset arithmetic.
 */
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

const AnalyticsFieldValuePrimitive = Schema.Union([
  Schema.String,
  Schema.Finite,
  Schema.Boolean,
  Schema.Null,
]);

/** A filter operand: one primitive, or a set of them for `in` / `not_in`. */
export const AnalyticsFieldValue = Schema.Union([
  AnalyticsFieldValuePrimitive,
  Schema.Array(AnalyticsFieldValuePrimitive),
]);

/** A single `field op value` comparison. */
export const AnalyticsFilterPredicate = Schema.Struct({
  field: Schema.String,
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
}).annotate({ identifier: "AnalyticsFilterPredicate" });

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

// `Schema.Schema<T>` extends `Top`, whose `DecodingServices`/`EncodingServices`
// are `unknown`; pinning the codec to `never` keeps the recursion from leaking
// service requirements into every endpoint that embeds a filter.
type AnalyticsFilterCodec = Schema.Codec<AnalyticsFilterType, AnalyticsFilterType, never, never>;

/** A boolean tree of predicates. Mirrors the dashboard's filter model exactly. */
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

/** Split a result by a dimension. Only supported on a subset of insights. */
export const AnalyticsBreakdown = Schema.Struct({
  field: Schema.String,
  limit: Schema.optional(
    Schema.Number.check(Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(100)),
  ),
  order: Schema.optional(Schema.Union([Schema.Literal("asc"), Schema.Literal("desc")])),
}).annotate({ identifier: "AnalyticsBreakdown" });

/** The catalogue of built-in insights every project can query without setup. */
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

/**
 * One insight in a batch. `key` is caller-chosen and echoed back on the
 * matching result, so a batch can be reassembled without relying on ordering.
 *
 * Unlike the RPC form there is no `context.organizationId`: the HTTP surface is
 * project-scoped and the server derives the organization from the resolved
 * project.
 */
export const AnalyticsInsightQuery = Schema.Struct({
  breakdowns: Schema.optional(Schema.Array(AnalyticsBreakdown)),
  filter: Schema.optional(AnalyticsFilter),
  granularity: Schema.optional(AnalyticsGranularity),
  insightId: BuiltInInsightId,
  key: Schema.String,
  limit: Schema.optional(Schema.Number),
  timeRange: AnalyticsTimeRange,
}).annotate({ identifier: "AnalyticsInsightQuery" });

/**
 * Body of `POST /analytics/queries/insights`. A batch keeps a dashboard's worth
 * of tiles on one round trip; the cap bounds the work a single request can
 * schedule.
 */
export class QueryInsightsBody extends Schema.Class<QueryInsightsBody>("QueryInsightsBody")({
  projectId: Schema.optional(Schema.String),
  queries: Schema.NonEmptyArray(AnalyticsInsightQuery).check(Schema.isMaxLength(20)),
}) {}

// ========================================================
// Query results
// ========================================================

/** One point on a sparkline or timeseries. */
export const AnalyticsDataPoint = Schema.Struct({
  timestamp: Schema.Date,
  value: Schema.Number,
}).annotate({ identifier: "AnalyticsDataPoint" });

/** The headline number for an insight; `currency` is set on monetary insights. */
export const AnalyticsSummary = Schema.Struct({
  currency: Schema.optional(Schema.String),
  value: Schema.Number,
}).annotate({ identifier: "AnalyticsSummary" });

const AnalyticsMetricResult = Schema.Struct({
  kind: Schema.Literal("metric"),
  sparkline: Schema.Array(AnalyticsDataPoint),
  summary: AnalyticsSummary,
});

const AnalyticsTimeseriesResult = Schema.Struct({
  kind: Schema.Literal("timeseries"),
  series: Schema.Array(AnalyticsDataPoint),
  summary: AnalyticsSummary,
});

const AnalyticsBreakdownResult = Schema.Struct({
  kind: Schema.Literal("breakdown"),
  rows: Schema.Array(
    Schema.Struct({
      key: Schema.String,
      label: Schema.String,
      value: Schema.Number,
    }),
  ),
  summary: Schema.optional(AnalyticsSummary),
});

/** Kind-tagged result; discriminate on `kind` before reading the payload. */
export const AnalyticsInsightResult = Schema.Union([
  AnalyticsMetricResult,
  AnalyticsTimeseriesResult,
  AnalyticsBreakdownResult,
]);

/** One entry of a batch response, keyed back to the request by `key`. */
export const AnalyticsInsightResponseItem = Schema.Struct({
  insightId: BuiltInInsightId,
  key: Schema.String,
  resolvedTimeRange: Schema.Struct({
    end: Schema.Date,
    start: Schema.Date,
  }),
  result: AnalyticsInsightResult,
}).annotate({ identifier: "AnalyticsInsightResponseItem" });

/** Success body of `POST /analytics/queries/insights`. */
export class QueryInsightsResult extends Schema.Class<QueryInsightsResult>("QueryInsightsResult")({
  results: Schema.Array(AnalyticsInsightResponseItem),
}) {}

// ========================================================
// Captured events
// ========================================================

/**
 * A single captured analytics event as it was persisted by `/i/v1/capture`.
 * Person identity is reported by id and distinct id only; hydrating names and
 * emails is a separate `GET /persons/:personId` call.
 */
export class AnalyticsEvent extends Schema.Class<AnalyticsEvent>("AnalyticsEvent")({
  captureId: Schema.String,
  context: Schema.Record(Schema.String, Schema.Unknown),
  distinctId: Schema.NullOr(Schema.String),
  eventId: Schema.String,
  eventName: Schema.String,
  identityMode: Schema.String,
  personId: Schema.NullOr(Schema.String),
  previousDistinctId: Schema.NullOr(Schema.String),
  /**
   * When the event row was inserted into the analytics store. Together with
   * {@link receivedAt} this measures how long the event sat in the ingest
   * queue.
   */
  processedAt: Schema.Date,
  properties: Schema.Record(Schema.String, Schema.Unknown),
  /** When the capture endpoint accepted the event into the processing pipeline. */
  receivedAt: Schema.Date,
  requestId: Schema.String,
  source: Schema.String,
  /**
   * The event's own timestamp as reported by the capturing client (device
   * clock) — the capture payload's `timestamp` field. May differ arbitrarily
   * from {@link receivedAt} when the device clock is skewed or the event was
   * batched offline.
   */
  timestamp: Schema.Date,
}) {}

/**
 * Query parameters of `GET /events`. `eventName` filters the collection to one
 * event type; results are in descending arrival order (most recently ingested
 * first), which is the order the cursor walks.
 */
export const EventListParams = Schema.Struct({
  ...PageParams.fields,
  eventName: Schema.optional(Schema.String),
  projectId: Schema.optional(Schema.String),
}).annotate({ identifier: "EventListParams" });

// ========================================================
// Ingest policy
// ========================================================

/** One built-in event entry resolved against the project's stored overrides. */
export const BuiltinEventAdmission = Schema.Struct({
  defaultEnabled: Schema.Boolean,
  description: Schema.String,
  enabled: Schema.Boolean,
  eventNames: Schema.Array(Schema.String),
  key: Schema.String,
  name: Schema.String,
  override: Schema.NullOr(Schema.Boolean),
  warning: Schema.NullOr(Schema.String),
}).annotate({ identifier: "BuiltinEventAdmission" });

/**
 * A project's complete event admission policy. Built-in (`$`-prefixed) events
 * are toggles over a code registry; custom events are admitted by default and
 * turned off by name.
 */
export class EventAdmissionPolicy extends Schema.Class<EventAdmissionPolicy>(
  "EventAdmissionPolicy",
)({
  builtinEvents: Schema.Array(BuiltinEventAdmission),
  customEventBlocklist: Schema.Array(Schema.String),
}) {}

/** Query parameters for `GET /ingest-policy`. */
export const IngestPolicyParams = Schema.Struct({
  projectId: Schema.optional(Schema.String),
}).annotate({ identifier: "IngestPolicyParams" });

/** Body of `PUT /ingest-policy/builtin-events/:key`. */
export class SetBuiltinEventAdmissionBody extends Schema.Class<SetBuiltinEventAdmissionBody>(
  "SetBuiltinEventAdmissionBody",
)({
  enabled: Schema.Boolean,
  projectId: Schema.optional(Schema.String),
}) {}

/** Body of `PUT /ingest-policy/custom-events/:eventName`. */
export class SetCustomEventBlockedBody extends Schema.Class<SetCustomEventBlockedBody>(
  "SetCustomEventBlockedBody",
)({
  blocked: Schema.Boolean,
  projectId: Schema.optional(Schema.String),
}) {}
