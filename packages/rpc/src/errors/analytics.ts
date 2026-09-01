/**
 * Analytics errors — typed errors returned by analytics RPCs (invalid time
 * range, unknown insight, unsupported filter/breakdown) plus the catch-all
 * service error. Class names and `_tag` values are namespaced with `Rpc` /
 * `Rpc/`.
 */
import * as Schema from "effect/Schema";

/** Time range parameters were rejected during normalisation. */
export class RpcInvalidTimeRangeError extends Schema.TaggedErrorClass<RpcInvalidTimeRangeError>(
  "RpcInvalidTimeRangeError",
)("Rpc/InvalidTimeRangeError", { message: Schema.String }) {}

/** Caller asked for a metric the service doesn't recognise. */
export class RpcInvalidMetricError extends Schema.TaggedErrorClass<RpcInvalidMetricError>(
  "RpcInvalidMetricError",
)("Rpc/InvalidMetricError", { message: Schema.String, metric: Schema.String }) {}

/** Generic invalid analytics query — composition rules violated. */
export class RpcInvalidAnalyticsQueryError extends Schema.TaggedErrorClass<RpcInvalidAnalyticsQueryError>(
  "RpcInvalidAnalyticsQueryError",
)("Rpc/InvalidAnalyticsQueryError", { message: Schema.String }) {}

/** Caller asked for an insight id that's not in the registry. */
export class RpcUnknownInsightError extends Schema.TaggedErrorClass<RpcUnknownInsightError>(
  "RpcUnknownInsightError",
)("Rpc/UnknownInsightError", { insightId: Schema.String, message: Schema.String }) {}

/** Caller filtered on a field the insight doesn't support. */
export class RpcUnsupportedAnalyticsFilterError extends Schema.TaggedErrorClass<RpcUnsupportedAnalyticsFilterError>(
  "RpcUnsupportedAnalyticsFilterError",
)("Rpc/UnsupportedAnalyticsFilterError", { field: Schema.String, message: Schema.String }) {}

/** Caller broke down by a field the insight doesn't support. */
export class RpcUnsupportedAnalyticsBreakdownError extends Schema.TaggedErrorClass<RpcUnsupportedAnalyticsBreakdownError>(
  "RpcUnsupportedAnalyticsBreakdownError",
)("Rpc/UnsupportedAnalyticsBreakdownError", { field: Schema.String, message: Schema.String }) {}

/**
 * Catch-all analytics service error. Wraps `SqlError`, `DatabaseError`, and
 * other infrastructural failures at the public-method boundary.
 */
export class RpcAnalyticsServiceError extends Schema.TaggedErrorClass<RpcAnalyticsServiceError>(
  "RpcAnalyticsServiceError",
)("Rpc/AnalyticsServiceError", { cause: Schema.String, message: Schema.String }) {}
