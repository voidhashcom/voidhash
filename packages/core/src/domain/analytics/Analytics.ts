/**
 * Analytics domain — typed errors that signal an analytics-specific invariant
 * violation (invalid time range, unknown insight, unsupported filter/breakdown)
 * and the shared insight registry / filter compiler types that the analytics
 * service composes against.
 *
 * The catch-all `AnalyticsServiceError` lives with the service.
 */
import { constant } from "@voidhash/lib/lang";
import { DateTime, Effect, Schema } from "effect";

/** Time range parameters were rejected during normalisation. */
export class InvalidTimeRangeError extends Schema.TaggedErrorClass<InvalidTimeRangeError>(
  "InvalidTimeRangeError",
)("InvalidTimeRangeError", { message: Schema.String }) {}

/** Caller asked for a metric the service doesn't recognise. */
export class InvalidMetricError extends Schema.TaggedErrorClass<InvalidMetricError>(
  "InvalidMetricError",
)("InvalidMetricError", { message: Schema.String, metric: Schema.String }) {}

/** Generic invalid analytics query — composition rules violated. */
export class InvalidAnalyticsQueryError extends Schema.TaggedErrorClass<InvalidAnalyticsQueryError>(
  "InvalidAnalyticsQueryError",
)("InvalidAnalyticsQueryError", { message: Schema.String }) {}

/** Caller asked for an insight id that's not in the registry. */
export class UnknownInsightError extends Schema.TaggedErrorClass<UnknownInsightError>(
  "UnknownInsightError",
)("UnknownInsightError", { insightId: Schema.String, message: Schema.String }) {}

/** Caller filtered on a field the insight doesn't support. */
export class UnsupportedAnalyticsFilterError extends Schema.TaggedErrorClass<UnsupportedAnalyticsFilterError>(
  "UnsupportedAnalyticsFilterError",
)("UnsupportedAnalyticsFilterError", { field: Schema.String, message: Schema.String }) {}

/** Caller broke down by a field the insight doesn't support. */
export class UnsupportedAnalyticsBreakdownError extends Schema.TaggedErrorClass<UnsupportedAnalyticsBreakdownError>(
  "UnsupportedAnalyticsBreakdownError",
)("UnsupportedAnalyticsBreakdownError", { field: Schema.String, message: Schema.String }) {}

// =============================================================================
// Built-in insight registry
// =============================================================================

export type TimeGranularity = "hour" | "day" | "week" | "month" | "quarter" | "year";

export interface AnalyticsDataPoint {
  timestamp: Date;
  value: number;
}

export interface TimeRangeParams {
  endDate: Date;
  granularity: TimeGranularity;
  startDate: Date;
}

export interface CompiledAnalyticsFilter {
  productIds?: string[];
  projectIds: string[];
  providerEnvironments?: number[];
  subscriptionStatuses?: number[];
}

export type BuiltInInsightId =
  | "builtin/revenue"
  | "builtin/mrr"
  | "builtin/arr"
  | "builtin/mrr_growth_rate"
  | "builtin/churn_rate"
  | "builtin/churned_revenue"
  | "builtin/person_count"
  | "builtin/new_persons"
  | "builtin/retention"
  | "builtin/arpu"
  | "builtin/arppu"
  | "builtin/active_subscriptions"
  | "builtin/active_trials"
  | "builtin/active_subscribers_growth"
  | "builtin/new_subscriptions"
  | "builtin/churned_subscriptions"
  | "builtin/subscriber_lifetime_value"
  | "builtin/trials"
  | "builtin/trial_conversions"
  | "builtin/trial_conversion_rate";

export type AnalyticsTimeRange =
  | { preset: "today" | "last_7d" | "last_30d" | "last_90d" | "last_365d" | "mtd" | "qtd" | "ytd" }
  | { end: Date; preset: "custom"; start: Date };

type PrimitiveFilterValue = string | number | boolean | null;
type FilterValue = PrimitiveFilterValue | ReadonlyArray<PrimitiveFilterValue>;

export type AnalyticsFilter =
  | {
      field: string;
      op: "eq" | "neq" | "in" | "not_in" | "gt" | "gte" | "lt" | "lte" | "contains" | "exists";
      type: "predicate";
      value?: FilterValue;
    }
  | {
      filters: ReadonlyArray<AnalyticsFilter>;
      type: "and" | "or";
    }
  | {
      filter: AnalyticsFilter;
      type: "not";
    };

export interface AnalyticsInsightQuery {
  breakdowns?: ReadonlyArray<{ field: string; limit?: number; order?: "asc" | "desc" }>;
  filter?: AnalyticsFilter;
  granularity?: TimeGranularity;
  insightId: BuiltInInsightId;
  key: string;
  limit?: number;
  timeRange: AnalyticsTimeRange;
}

export interface AnalyticsInsightSummary {
  currency?: string;
  value: number;
}

export interface AnalyticsMetricResult {
  kind: "metric";
  sparkline: AnalyticsDataPoint[];
  summary: AnalyticsInsightSummary;
}

export interface AnalyticsBreakdownResult {
  kind: "breakdown";
  rows: Array<{ key: string; label: string; value: number }>;
  summary?: AnalyticsInsightSummary;
}

export interface AnalyticsTimeseriesResult {
  kind: "timeseries";
  series: AnalyticsDataPoint[];
  summary: AnalyticsInsightSummary;
}

export type AnalyticsInsightResult =
  | AnalyticsMetricResult
  | AnalyticsTimeseriesResult
  | AnalyticsBreakdownResult;

export interface InsightDefinition {
  defaultGranularity: TimeGranularity;
  id: BuiltInInsightId;
  resultKind: "metric";
  supportedBreakdownFields: readonly string[];
  supportedFilterFields: readonly string[];
  supportedGranularities: readonly TimeGranularity[];
}

const DEFAULT_FILTER_FIELDS = constant(["project.id"]);
const REVENUE_FILTER_FIELDS = constant([
  "project.id",
  "product.id",
  "provider.environment",
  "subscription.status",
]);

const ALL_GRANULARITIES: ReadonlyArray<TimeGranularity> = [
  "hour",
  "day",
  "week",
  "month",
  "quarter",
  "year",
];

const NON_HOURLY_GRANULARITIES: ReadonlyArray<TimeGranularity> = [
  "day",
  "week",
  "month",
  "quarter",
  "year",
];

export const BUILT_IN_INSIGHTS = [
  {
    defaultGranularity: "day",
    id: "builtin/revenue",
    resultKind: "metric",
    supportedBreakdownFields: [],
    supportedFilterFields: REVENUE_FILTER_FIELDS,
    supportedGranularities: ALL_GRANULARITIES,
  },
  {
    defaultGranularity: "day",
    id: "builtin/mrr",
    resultKind: "metric",
    supportedBreakdownFields: [],
    supportedFilterFields: REVENUE_FILTER_FIELDS,
    supportedGranularities: NON_HOURLY_GRANULARITIES,
  },
  {
    defaultGranularity: "day",
    id: "builtin/arr",
    resultKind: "metric",
    supportedBreakdownFields: [],
    supportedFilterFields: REVENUE_FILTER_FIELDS,
    supportedGranularities: NON_HOURLY_GRANULARITIES,
  },
  {
    defaultGranularity: "day",
    id: "builtin/mrr_growth_rate",
    resultKind: "metric",
    supportedBreakdownFields: [],
    supportedFilterFields: REVENUE_FILTER_FIELDS,
    supportedGranularities: NON_HOURLY_GRANULARITIES,
  },
  {
    defaultGranularity: "day",
    id: "builtin/churn_rate",
    resultKind: "metric",
    supportedBreakdownFields: [],
    supportedFilterFields: REVENUE_FILTER_FIELDS,
    supportedGranularities: NON_HOURLY_GRANULARITIES,
  },
  {
    defaultGranularity: "day",
    id: "builtin/churned_revenue",
    resultKind: "metric",
    supportedBreakdownFields: [],
    supportedFilterFields: REVENUE_FILTER_FIELDS,
    supportedGranularities: NON_HOURLY_GRANULARITIES,
  },
  {
    defaultGranularity: "day",
    id: "builtin/person_count",
    resultKind: "metric",
    supportedBreakdownFields: [],
    supportedFilterFields: DEFAULT_FILTER_FIELDS,
    supportedGranularities: NON_HOURLY_GRANULARITIES,
  },
  {
    defaultGranularity: "day",
    id: "builtin/new_persons",
    resultKind: "metric",
    supportedBreakdownFields: [],
    supportedFilterFields: DEFAULT_FILTER_FIELDS,
    supportedGranularities: NON_HOURLY_GRANULARITIES,
  },
  {
    defaultGranularity: "day",
    id: "builtin/retention",
    resultKind: "metric",
    supportedBreakdownFields: [],
    supportedFilterFields: REVENUE_FILTER_FIELDS,
    supportedGranularities: NON_HOURLY_GRANULARITIES,
  },
  {
    defaultGranularity: "day",
    id: "builtin/arpu",
    resultKind: "metric",
    supportedBreakdownFields: [],
    supportedFilterFields: REVENUE_FILTER_FIELDS,
    supportedGranularities: NON_HOURLY_GRANULARITIES,
  },
  {
    defaultGranularity: "day",
    id: "builtin/arppu",
    resultKind: "metric",
    supportedBreakdownFields: [],
    supportedFilterFields: REVENUE_FILTER_FIELDS,
    supportedGranularities: NON_HOURLY_GRANULARITIES,
  },
  {
    defaultGranularity: "day",
    id: "builtin/active_subscriptions",
    resultKind: "metric",
    supportedBreakdownFields: [],
    supportedFilterFields: REVENUE_FILTER_FIELDS,
    supportedGranularities: NON_HOURLY_GRANULARITIES,
  },
  {
    defaultGranularity: "day",
    id: "builtin/active_trials",
    resultKind: "metric",
    supportedBreakdownFields: [],
    supportedFilterFields: REVENUE_FILTER_FIELDS,
    supportedGranularities: NON_HOURLY_GRANULARITIES,
  },
  {
    defaultGranularity: "day",
    id: "builtin/active_subscribers_growth",
    resultKind: "metric",
    supportedBreakdownFields: [],
    supportedFilterFields: REVENUE_FILTER_FIELDS,
    supportedGranularities: NON_HOURLY_GRANULARITIES,
  },
  {
    defaultGranularity: "day",
    id: "builtin/new_subscriptions",
    resultKind: "metric",
    supportedBreakdownFields: [],
    supportedFilterFields: REVENUE_FILTER_FIELDS,
    supportedGranularities: NON_HOURLY_GRANULARITIES,
  },
  {
    defaultGranularity: "day",
    id: "builtin/churned_subscriptions",
    resultKind: "metric",
    supportedBreakdownFields: [],
    supportedFilterFields: REVENUE_FILTER_FIELDS,
    supportedGranularities: NON_HOURLY_GRANULARITIES,
  },
  {
    defaultGranularity: "day",
    id: "builtin/trials",
    resultKind: "metric",
    supportedBreakdownFields: [],
    supportedFilterFields: REVENUE_FILTER_FIELDS,
    supportedGranularities: NON_HOURLY_GRANULARITIES,
  },
  {
    defaultGranularity: "day",
    id: "builtin/subscriber_lifetime_value",
    resultKind: "metric",
    supportedBreakdownFields: [],
    supportedFilterFields: REVENUE_FILTER_FIELDS,
    supportedGranularities: NON_HOURLY_GRANULARITIES,
  },
  {
    defaultGranularity: "day",
    id: "builtin/trial_conversions",
    resultKind: "metric",
    supportedBreakdownFields: [],
    supportedFilterFields: REVENUE_FILTER_FIELDS,
    supportedGranularities: NON_HOURLY_GRANULARITIES,
  },
  {
    defaultGranularity: "day",
    id: "builtin/trial_conversion_rate",
    resultKind: "metric",
    supportedBreakdownFields: [],
    supportedFilterFields: REVENUE_FILTER_FIELDS,
    supportedGranularities: NON_HOURLY_GRANULARITIES,
  },
] satisfies InsightDefinition[];

// =============================================================================
// Field registry — supported / reserved analytics filter fields.
// =============================================================================

export const SUPPORTED_REVENUE_FILTER_FIELDS = constant([
  "project.id",
  "product.id",
  "provider.environment",
  "subscription.status",
]);

export type SupportedRevenueFilterField = (typeof SUPPORTED_REVENUE_FILTER_FIELDS)[number];

export const RESERVED_ANALYTICS_FIELD_PREFIXES = constant([
  "event.",
  "person.properties.",
  "event.properties.",
  "context.",
]);

export const isSupportedRevenueFilterField = (
  field: string,
): field is SupportedRevenueFilterField =>
  SUPPORTED_REVENUE_FILTER_FIELDS.some((supported) => supported === field);

export const isReservedAnalyticsField = (field: string): boolean =>
  RESERVED_ANALYTICS_FIELD_PREFIXES.some((prefix) => field.startsWith(prefix));

// =============================================================================
// Insight classification sets (CURRENCY / RATE) and aggregation helpers.
// =============================================================================

export const CURRENCY_INSIGHTS = new Set<BuiltInInsightId>([
  "builtin/revenue",
  "builtin/mrr",
  "builtin/arr",
  "builtin/churned_revenue",
  "builtin/arpu",
  "builtin/arppu",
  "builtin/subscriber_lifetime_value",
]);

export const RATE_INSIGHTS = new Set<BuiltInInsightId>([
  "builtin/churn_rate",
  "builtin/mrr_growth_rate",
  "builtin/active_subscribers_growth",
  "builtin/retention",
  "builtin/trial_conversion_rate",
]);

export const sumDataPoints = (dataPoints: ReadonlyArray<AnalyticsDataPoint>): number =>
  dataPoints.reduce((sum, dataPoint) => sum + dataPoint.value, 0);

export const avgDataPoints = (dataPoints: ReadonlyArray<AnalyticsDataPoint>): number => {
  if (dataPoints.length === 0) return 0;
  return sumDataPoints(dataPoints) / dataPoints.length;
};

// =============================================================================
// Insight registry lookup + breakdown guard
// =============================================================================

const INSIGHT_REGISTRY = new Map<string, InsightDefinition>(
  BUILT_IN_INSIGHTS.map((insight) => [insight.id, insight]),
);

export const getBuiltInInsight = (
  insightId: string,
): Effect.Effect<InsightDefinition, UnknownInsightError> => {
  const insight = INSIGHT_REGISTRY.get(insightId);
  if (insight) return Effect.succeed(insight);
  return Effect.fail(
    new UnknownInsightError({ insightId, message: `Unknown analytics insight ${insightId}` }),
  );
};

export const ensureNoBreakdowns = (
  breakdowns: AnalyticsInsightQuery["breakdowns"] | undefined,
): Effect.Effect<void, UnsupportedAnalyticsBreakdownError> => {
  if (!breakdowns || breakdowns.length === 0) return Effect.void;
  return Effect.fail(
    new UnsupportedAnalyticsBreakdownError({
      field: breakdowns[0]?.field ?? "unknown",
      message: "Breakdowns are not supported in this PoC",
    }),
  );
};

// =============================================================================
// Time-range resolution
// =============================================================================

/**
 * Truncate sub-second precision. ClickHouse's `DateTime` column rejects
 * fractional-second timestamps when bound as query parameters, and analytics
 * buckets never care about sub-seconds, so we floor at the resolver boundary.
 */
const truncateToSecond = (date: Date): Date =>
  fromEpochMillis(Math.floor(date.getTime() / 1000) * 1000);

/** Builds a `Date` from epoch milliseconds without the banned `new Date(ms)`. */
const fromEpochMillis = (millis: number): Date => DateTime.toDateUtc(DateTime.makeUnsafe(millis));

/**
 * Builds a `Date` from calendar parts interpreted in the host time zone, which
 * is what the `new Date(year, monthIndex, day)` constructor did here. `month` is
 * one-based for `DateTime`, unlike the zero-based constructor argument.
 */
const fromLocalParts = (parts: { day: number; month: number; year: number }): Date =>
  DateTime.toDateUtc(
    DateTime.makeZonedUnsafe(parts, {
      adjustForTimeZone: true,
      timeZone: DateTime.zoneMakeLocal(),
    }),
  );

export const resolveTimeRange = (
  timeRange: AnalyticsTimeRange,
): Effect.Effect<{ end: Date; start: Date }, InvalidTimeRangeError> =>
  Effect.gen(function* () {
    const now = truncateToSecond(yield* DateTime.nowAsDate);

    switch (timeRange.preset) {
      case "today":
        return {
          end: now,
          start: fromLocalParts({
            day: now.getDate(),
            month: now.getMonth() + 1,
            year: now.getFullYear(),
          }),
        };
      case "last_7d":
        return { end: now, start: fromEpochMillis(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
      case "last_30d":
        return { end: now, start: fromEpochMillis(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
      case "last_90d":
        return { end: now, start: fromEpochMillis(now.getTime() - 90 * 24 * 60 * 60 * 1000) };
      case "last_365d":
        return { end: now, start: fromEpochMillis(now.getTime() - 365 * 24 * 60 * 60 * 1000) };
      case "mtd":
        return {
          end: now,
          start: fromLocalParts({ day: 1, month: now.getMonth() + 1, year: now.getFullYear() }),
        };
      case "qtd": {
        const quarter = Math.floor(now.getMonth() / 3);
        return {
          end: now,
          start: fromLocalParts({ day: 1, month: quarter * 3 + 1, year: now.getFullYear() }),
        };
      }
      case "ytd":
        return { end: now, start: fromLocalParts({ day: 1, month: 1, year: now.getFullYear() }) };
      case "custom": {
        if (timeRange.start > timeRange.end) {
          return yield* Effect.fail(
            new InvalidTimeRangeError({ message: "start must be before end" }),
          );
        }
        return { end: truncateToSecond(timeRange.end), start: truncateToSecond(timeRange.start) };
      }
    }
  });

// =============================================================================
// Filter compiler — AnalyticsFilter AST → CompiledAnalyticsFilter constraints
// =============================================================================

interface CompileAnalyticsFilterOptions {
  availableProjectIds: string[];
  filter?: AnalyticsFilter;
  supportedFields: readonly string[];
}

interface PartialConstraints {
  productIds?: string[];
  projectIds?: string[];
  providerEnvironments?: number[];
  subscriptionStatuses?: number[];
}

const ensureSupportedField = (
  field: string,
  supportedFields: readonly string[],
): Effect.Effect<void, UnsupportedAnalyticsFilterError> => {
  if (!isSupportedRevenueFilterField(field)) {
    if (isReservedAnalyticsField(field)) {
      return Effect.fail(
        new UnsupportedAnalyticsFilterError({
          field,
          message: `Field ${field} is reserved for a future analytics domain`,
        }),
      );
    }
    return Effect.fail(
      new UnsupportedAnalyticsFilterError({ field, message: `Field ${field} is not supported` }),
    );
  }
  if (!supportedFields.includes(field)) {
    return Effect.fail(
      new UnsupportedAnalyticsFilterError({
        field,
        message: `Field ${field} is not supported for this insight`,
      }),
    );
  }
  return Effect.void;
};

const isPrimitiveFilterValue = (value: FilterValue): value is PrimitiveFilterValue =>
  value === null || typeof value !== "object";

const toArray = (value: FilterValue | undefined): PrimitiveFilterValue[] => {
  if (value === undefined) return [];
  if (isPrimitiveFilterValue(value)) return [value];
  return [...value];
};

const toStringArray = (
  field: SupportedRevenueFilterField,
  value: FilterValue | undefined,
): Effect.Effect<string[], InvalidAnalyticsQueryError> => {
  const values = toArray(value);
  const strings = values.filter((item) => typeof item === "string");
  if (strings.length !== values.length) {
    return Effect.fail(
      new InvalidAnalyticsQueryError({ message: `Filter ${field} expects string values` }),
    );
  }
  return Effect.succeed(strings);
};

const toNumberArray = (
  field: SupportedRevenueFilterField,
  value: FilterValue | undefined,
): Effect.Effect<number[], InvalidAnalyticsQueryError> => {
  const values = toArray(value);
  const numbers = values.filter((item) => typeof item === "number");
  if (numbers.length !== values.length) {
    return Effect.fail(
      new InvalidAnalyticsQueryError({ message: `Filter ${field} expects numeric values` }),
    );
  }
  return Effect.succeed(numbers);
};

const intersect = <T>(left: T[] | undefined, right: T[] | undefined): T[] | undefined => {
  if (!left) return right;
  if (!right) return left;
  return left.filter((item) => right.includes(item));
};

const union = <T>(left: T[] | undefined, right: T[] | undefined): T[] | undefined => {
  if (!left) return right;
  if (!right) return left;
  return [...new Set([...left, ...right])];
};

const mergeAndConstraints = (
  left: PartialConstraints,
  right: PartialConstraints,
): PartialConstraints => ({
  productIds: intersect(left.productIds, right.productIds),
  projectIds: intersect(left.projectIds, right.projectIds),
  providerEnvironments: intersect(left.providerEnvironments, right.providerEnvironments),
  subscriptionStatuses: intersect(left.subscriptionStatuses, right.subscriptionStatuses),
});

const mergeOrConstraints = (
  left: PartialConstraints,
  right: PartialConstraints,
): Effect.Effect<PartialConstraints, UnsupportedAnalyticsFilterError> => {
  const mixedFields =
    [left.projectIds, left.productIds, left.providerEnvironments, left.subscriptionStatuses].filter(
      Boolean,
    ).length > 1 ||
    [
      right.projectIds,
      right.productIds,
      right.providerEnvironments,
      right.subscriptionStatuses,
    ].filter(Boolean).length > 1;

  if (mixedFields) {
    return Effect.fail(
      new UnsupportedAnalyticsFilterError({
        field: "or",
        message: "OR filters are only supported for a single field in this PoC",
      }),
    );
  }

  return Effect.succeed({
    productIds: union(left.productIds, right.productIds),
    projectIds: union(left.projectIds, right.projectIds),
    providerEnvironments: union(left.providerEnvironments, right.providerEnvironments),
    subscriptionStatuses: union(left.subscriptionStatuses, right.subscriptionStatuses),
  });
};

const compilePredicate = ({
  availableProjectIds,
  filter,
}: {
  availableProjectIds: string[];
  filter: Extract<AnalyticsFilter, { type: "predicate" }>;
}): Effect.Effect<
  PartialConstraints,
  InvalidAnalyticsQueryError | UnsupportedAnalyticsFilterError
> =>
  Effect.gen(function* () {
    const { field, op, value } = filter;

    switch (field) {
      case "project.id": {
        if (op === "eq" || op === "in") {
          const ids = yield* toStringArray(field, value);
          return { projectIds: availableProjectIds.filter((id) => ids.includes(id)) };
        }
        if (op === "neq" || op === "not_in") {
          const ids = yield* toStringArray(field, value);
          return { projectIds: availableProjectIds.filter((id) => !ids.includes(id)) };
        }
        break;
      }
      case "product.id": {
        if (op === "eq" || op === "in") {
          return { productIds: yield* toStringArray(field, value) };
        }
        break;
      }
      case "provider.environment": {
        if (op === "eq" || op === "in") {
          return { providerEnvironments: yield* toNumberArray(field, value) };
        }
        break;
      }
      case "subscription.status": {
        if (op === "eq" || op === "in") {
          return { subscriptionStatuses: yield* toNumberArray(field, value) };
        }
        break;
      }
    }

    return yield* Effect.fail(
      new UnsupportedAnalyticsFilterError({
        field,
        message: `Operator ${op} is not supported for ${field} in this PoC`,
      }),
    );
  });

type PredicateOp = Extract<AnalyticsFilter, { type: "predicate" }>["op"];

/** Inverts the equality operators a NOT filter wraps; other operators pass through. */
const negatePredicateOp = (op: PredicateOp): PredicateOp => {
  if (op === "eq") return "neq";
  if (op === "in") return "not_in";
  return op;
};

const compileNode = ({
  availableProjectIds,
  filter,
  supportedFields,
}: CompileAnalyticsFilterOptions & { filter: AnalyticsFilter }): Effect.Effect<
  PartialConstraints,
  InvalidAnalyticsQueryError | UnsupportedAnalyticsFilterError
> =>
  Effect.gen(function* () {
    switch (filter.type) {
      case "predicate": {
        yield* ensureSupportedField(filter.field, supportedFields);
        return yield* compilePredicate({ availableProjectIds, filter });
      }
      case "and": {
        let current: PartialConstraints = {};
        for (const child of filter.filters) {
          current = mergeAndConstraints(
            current,
            yield* compileNode({ availableProjectIds, filter: child, supportedFields }),
          );
        }
        return current;
      }
      case "or": {
        let current: PartialConstraints = {};
        for (const child of filter.filters) {
          current = yield* mergeOrConstraints(
            current,
            yield* compileNode({ availableProjectIds, filter: child, supportedFields }),
          );
        }
        return current;
      }
      case "not": {
        if (filter.filter.type !== "predicate" || filter.filter.field !== "project.id") {
          return yield* Effect.fail(
            new UnsupportedAnalyticsFilterError({
              field: "not",
              message: "NOT filters are only supported for project.id in this PoC",
            }),
          );
        }
        return yield* compilePredicate({
          availableProjectIds,
          filter: { ...filter.filter, op: negatePredicateOp(filter.filter.op) },
        });
      }
    }
  });

export const compileAnalyticsFilter = ({
  availableProjectIds,
  filter,
  supportedFields,
}: CompileAnalyticsFilterOptions): Effect.Effect<
  CompiledAnalyticsFilter,
  InvalidAnalyticsQueryError | UnsupportedAnalyticsFilterError
> =>
  Effect.gen(function* () {
    let compiled: PartialConstraints = {};
    if (filter) {
      compiled = yield* compileNode({ availableProjectIds, filter, supportedFields });
    }

    return {
      productIds: compiled.productIds,
      projectIds: compiled.projectIds ?? availableProjectIds,
      providerEnvironments: compiled.providerEnvironments,
      subscriptionStatuses: compiled.subscriptionStatuses,
    };
  });
