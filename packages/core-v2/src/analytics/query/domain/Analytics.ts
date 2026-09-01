import * as P from "effect/Predicate";
import * as Arr from "effect/Array";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Option from "effect/Option";
/**
 * Analytics domain — typed errors that signal an analytics-specific invariant
 * violation (invalid time range, unknown insight, unsupported filter/breakdown)
 * and the shared insight registry / filter compiler types that the analytics
 * service composes against.
 *
 * The catch-all `AnalyticsServiceError` lives with the service.
 */
import { constant } from "@voidhash/lib/lang";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

/** Time range parameters were rejected during normalisation. */
export class InvalidTimeRangeError extends Schema.TaggedErrorClass<InvalidTimeRangeError>(
  "InvalidTimeRangeError",
)("InvalidTimeRangeError", { message: Schema.String }) {}

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

export const TimeGranularity = Schema.Literals(["hour", "day", "week", "month", "quarter", "year"]);
export type TimeGranularity = typeof TimeGranularity.Type;

export const AnalyticsDataPoint = Schema.Struct({
  timestamp: Schema.Date,
  value: Schema.Number,
});
export type AnalyticsDataPoint = typeof AnalyticsDataPoint.Type;

export interface TimeRangeParams {
  endDate: Date;
  granularity: typeof TimeGranularity.Type;
  startDate: Date;
}

export interface CompiledAnalyticsFilter {
  productIds?: string[];
  projectIds: string[];
  providerEnvironments?: number[];
}

export const BuiltInInsightId = Schema.Literals([
  "builtin/revenue",
  "builtin/mrr",
  "builtin/arr",
  "builtin/mrr_growth_rate",
  "builtin/churn_rate",
  "builtin/churned_revenue",
  "builtin/person_count",
  "builtin/new_persons",
  "builtin/retention",
  "builtin/arpu",
  "builtin/arppu",
  "builtin/active_subscriptions",
  "builtin/active_trials",
  "builtin/active_subscribers_growth",
  "builtin/new_subscriptions",
  "builtin/churned_subscriptions",
  "builtin/subscriber_lifetime_value",
  "builtin/trials",
  "builtin/trial_conversions",
  "builtin/trial_conversion_rate",
]);
export type BuiltInInsightId = typeof BuiltInInsightId.Type;

export const AnalyticsTimeRange = Schema.Union([
  Schema.Struct({
    preset: Schema.Literals([
      "today",
      "last_7d",
      "last_30d",
      "last_90d",
      "last_365d",
      "mtd",
      "qtd",
      "ytd",
    ]),
  }),
  Schema.Struct({
    end: Schema.Date,
    preset: Schema.Literal("custom"),
    start: Schema.Date,
  }),
]);
export type AnalyticsTimeRange = typeof AnalyticsTimeRange.Type;

type PrimitiveFilterValue = string | number | boolean | typeof Schema.Null.Type;
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

const PrimitiveFilterValue = Schema.Union([
  Schema.String,
  Schema.Number,
  Schema.Boolean,
  Schema.Null,
]);
const AnalyticsFilterValue = Schema.Union([
  PrimitiveFilterValue,
  Schema.Array(PrimitiveFilterValue),
]);
export const AnalyticsFilter: Schema.Codec<AnalyticsFilter> = Schema.Union([
  Schema.Struct({
    field: Schema.String,
    op: Schema.Literals([
      "eq",
      "neq",
      "in",
      "not_in",
      "gt",
      "gte",
      "lt",
      "lte",
      "contains",
      "exists",
    ]),
    type: Schema.Literal("predicate"),
    value: Schema.optional(AnalyticsFilterValue),
  }),
  Schema.Struct({
    filters: Schema.Array(Schema.suspend((): Schema.Codec<AnalyticsFilter> => AnalyticsFilter)),
    type: Schema.Literals(["and", "or"]),
  }),
  Schema.Struct({
    filter: Schema.suspend((): Schema.Codec<AnalyticsFilter> => AnalyticsFilter),
    type: Schema.Literal("not"),
  }),
]);

const PositiveInt = Schema.Int.pipe(Schema.refine((value): value is number => value > 0));

export const AnalyticsInsightQuery = Schema.Struct({
  breakdowns: Schema.optional(
    Schema.Array(
      Schema.Struct({
        field: Schema.String,
        limit: Schema.optional(PositiveInt),
        order: Schema.optional(Schema.Literals(["asc", "desc"])),
      }),
    ),
  ),
  filter: Schema.optional(AnalyticsFilter),
  granularity: Schema.optional(TimeGranularity),
  insightId: BuiltInInsightId,
  key: Schema.String,
  limit: Schema.optional(PositiveInt),
  timeRange: AnalyticsTimeRange,
});
export type AnalyticsInsightQuery = typeof AnalyticsInsightQuery.Type;

export const AnalyticsInsightSummary = Schema.Struct({
  currency: Schema.optional(Schema.String),
  value: Schema.Number,
});
export type AnalyticsInsightSummary = typeof AnalyticsInsightSummary.Type;

export const AnalyticsMetricResult = Schema.Struct({
  kind: Schema.Literal("metric"),
  sparkline: Schema.Array(AnalyticsDataPoint),
  summary: AnalyticsInsightSummary,
});
export type AnalyticsMetricResult = typeof AnalyticsMetricResult.Type;

export const AnalyticsInsightResult = AnalyticsMetricResult;

export interface InsightDefinition {
  defaultGranularity: typeof TimeGranularity.Type;
  id: typeof BuiltInInsightId.Type;
  supportedFilterFields: readonly string[];
  supportedGranularities: readonly (typeof TimeGranularity.Type)[];
}

const DEFAULT_FILTER_FIELDS = constant(["project.id"]);
const REVENUE_FILTER_FIELDS = constant(["project.id", "product.id", "provider.environment"]);

const ALL_GRANULARITIES: ReadonlyArray<typeof TimeGranularity.Type> = [
  "hour",
  "day",
  "week",
  "month",
  "quarter",
  "year",
];

const NON_HOURLY_GRANULARITIES: ReadonlyArray<typeof TimeGranularity.Type> = [
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
    supportedFilterFields: REVENUE_FILTER_FIELDS,
    supportedGranularities: ALL_GRANULARITIES,
  },
  {
    defaultGranularity: "day",
    id: "builtin/mrr",
    supportedFilterFields: REVENUE_FILTER_FIELDS,
    supportedGranularities: NON_HOURLY_GRANULARITIES,
  },
  {
    defaultGranularity: "day",
    id: "builtin/arr",
    supportedFilterFields: REVENUE_FILTER_FIELDS,
    supportedGranularities: NON_HOURLY_GRANULARITIES,
  },
  {
    defaultGranularity: "day",
    id: "builtin/mrr_growth_rate",
    supportedFilterFields: REVENUE_FILTER_FIELDS,
    supportedGranularities: NON_HOURLY_GRANULARITIES,
  },
  {
    defaultGranularity: "day",
    id: "builtin/churn_rate",
    supportedFilterFields: REVENUE_FILTER_FIELDS,
    supportedGranularities: NON_HOURLY_GRANULARITIES,
  },
  {
    defaultGranularity: "day",
    id: "builtin/churned_revenue",
    supportedFilterFields: REVENUE_FILTER_FIELDS,
    supportedGranularities: NON_HOURLY_GRANULARITIES,
  },
  {
    defaultGranularity: "day",
    id: "builtin/person_count",
    supportedFilterFields: DEFAULT_FILTER_FIELDS,
    supportedGranularities: NON_HOURLY_GRANULARITIES,
  },
  {
    defaultGranularity: "day",
    id: "builtin/new_persons",
    supportedFilterFields: DEFAULT_FILTER_FIELDS,
    supportedGranularities: NON_HOURLY_GRANULARITIES,
  },
  {
    defaultGranularity: "day",
    id: "builtin/retention",
    supportedFilterFields: REVENUE_FILTER_FIELDS,
    supportedGranularities: NON_HOURLY_GRANULARITIES,
  },
  {
    defaultGranularity: "day",
    id: "builtin/arpu",
    supportedFilterFields: REVENUE_FILTER_FIELDS,
    supportedGranularities: NON_HOURLY_GRANULARITIES,
  },
  {
    defaultGranularity: "day",
    id: "builtin/arppu",
    supportedFilterFields: REVENUE_FILTER_FIELDS,
    supportedGranularities: NON_HOURLY_GRANULARITIES,
  },
  {
    defaultGranularity: "day",
    id: "builtin/active_subscriptions",
    supportedFilterFields: REVENUE_FILTER_FIELDS,
    supportedGranularities: NON_HOURLY_GRANULARITIES,
  },
  {
    defaultGranularity: "day",
    id: "builtin/active_trials",
    supportedFilterFields: REVENUE_FILTER_FIELDS,
    supportedGranularities: NON_HOURLY_GRANULARITIES,
  },
  {
    defaultGranularity: "day",
    id: "builtin/active_subscribers_growth",
    supportedFilterFields: REVENUE_FILTER_FIELDS,
    supportedGranularities: NON_HOURLY_GRANULARITIES,
  },
  {
    defaultGranularity: "day",
    id: "builtin/new_subscriptions",
    supportedFilterFields: REVENUE_FILTER_FIELDS,
    supportedGranularities: NON_HOURLY_GRANULARITIES,
  },
  {
    defaultGranularity: "day",
    id: "builtin/churned_subscriptions",
    supportedFilterFields: REVENUE_FILTER_FIELDS,
    supportedGranularities: NON_HOURLY_GRANULARITIES,
  },
  {
    defaultGranularity: "day",
    id: "builtin/trials",
    supportedFilterFields: REVENUE_FILTER_FIELDS,
    supportedGranularities: NON_HOURLY_GRANULARITIES,
  },
  {
    defaultGranularity: "day",
    id: "builtin/subscriber_lifetime_value",
    supportedFilterFields: REVENUE_FILTER_FIELDS,
    supportedGranularities: NON_HOURLY_GRANULARITIES,
  },
  {
    defaultGranularity: "day",
    id: "builtin/trial_conversions",
    supportedFilterFields: REVENUE_FILTER_FIELDS,
    supportedGranularities: NON_HOURLY_GRANULARITIES,
  },
  {
    defaultGranularity: "day",
    id: "builtin/trial_conversion_rate",
    supportedFilterFields: REVENUE_FILTER_FIELDS,
    supportedGranularities: NON_HOURLY_GRANULARITIES,
  },
] satisfies InsightDefinition[];

// =============================================================================
// Field registry — supported / reserved analytics filter fields.
// =============================================================================

// `subscription.status` is intentionally absent: no emitter produces the
// property yet, so advertising the field would silently filter on nothing.
export const SUPPORTED_REVENUE_FILTER_FIELDS = constant([
  "project.id",
  "product.id",
  "provider.environment",
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

export const CURRENCY_INSIGHTS = HashSet.make(
  "builtin/revenue",
  "builtin/mrr",
  "builtin/arr",
  "builtin/churned_revenue",
  "builtin/arpu",
  "builtin/arppu",
  "builtin/subscriber_lifetime_value",
);

export const RATE_INSIGHTS = HashSet.make(
  "builtin/churn_rate",
  "builtin/mrr_growth_rate",
  "builtin/active_subscribers_growth",
  "builtin/retention",
  "builtin/trial_conversion_rate",
);

/** Point-in-time ("stock") insights whose summary is the latest bucket, not a sum. */
export const STOCK_INSIGHTS = HashSet.make(
  "builtin/active_subscriptions",
  "builtin/active_trials",
  "builtin/person_count",
);

export const sumDataPoints = (dataPoints: ReadonlyArray<typeof AnalyticsDataPoint.Type>): number =>
  dataPoints.reduce((sum, dataPoint) => sum + dataPoint.value, 0);

export const avgDataPoints = (
  dataPoints: ReadonlyArray<typeof AnalyticsDataPoint.Type>,
): number => {
  if (Arr.isReadonlyArrayEmpty(dataPoints)) return 0;
  return sumDataPoints(dataPoints) / dataPoints.length;
};

// =============================================================================
// Insight registry lookup + breakdown guard
// =============================================================================

const INSIGHT_REGISTRY: HashMap.HashMap<string, InsightDefinition> = HashMap.fromIterable(
  BUILT_IN_INSIGHTS.map((insight) => [insight.id, insight] as const),
);

export const getBuiltInInsight = (
  insightId: string,
): Effect.Effect<InsightDefinition, UnknownInsightError> => {
  return Option.match(HashMap.get(INSIGHT_REGISTRY, insightId), {
    onNone: () =>
      Effect.fail(
        new UnknownInsightError({ insightId, message: `Unknown analytics insight ${insightId}` }),
      ),
    onSome: Effect.succeed,
  });
};

export const ensureNoBreakdowns = (
  breakdowns: Option.Option<NonNullable<(typeof AnalyticsInsightQuery.Type)["breakdowns"]>>,
): Effect.Effect<void, UnsupportedAnalyticsBreakdownError> => {
  if (Option.isNone(breakdowns) || Arr.isReadonlyArrayEmpty(breakdowns.value)) return Effect.void;
  return Effect.fail(
    new UnsupportedAnalyticsBreakdownError({
      field: breakdowns.value[0]?.field ?? "unknown",
      message: "Breakdowns are not supported yet",
    }),
  );
};

// =============================================================================
// Time-range resolution
// =============================================================================

/**
 * Truncate sub-second precision because analytics buckets do not distinguish
 * values within the same second.
 */
const truncateToSecond = (date: Date) => fromEpochMillis(Math.floor(date.getTime() / 1000) * 1000);

/** Builds a `Date` from epoch milliseconds without the banned `new Date(ms)`. */
const fromEpochMillis = (millis: number) => DateTime.toDateUtc(DateTime.makeUnsafe(millis));

/**
 * Builds a `Date` from calendar parts interpreted in UTC so the calendar-based
 * presets (`today`, `mtd`, `qtd`, `ytd`) resolve identically on every host
 * regardless of the process time zone.
 */
const fromUtcParts = (parts: { day: number; month: number; year: number }) =>
  DateTime.toDateUtc(
    DateTime.makeZonedUnsafe(parts, {
      adjustForTimeZone: true,
      timeZone: DateTime.zoneMakeNamedUnsafe("UTC"),
    }),
  );

export const resolveTimeRange = (
  timeRange: typeof AnalyticsTimeRange.Type,
): Effect.Effect<{ end: Date; start: Date }, InvalidTimeRangeError> =>
  Effect.gen(function* () {
    const now = truncateToSecond(yield* DateTime.nowAsDate);

    if (timeRange.preset === "today") {
      return {
        end: now,
        start: fromUtcParts({
          day: now.getUTCDate(),
          month: now.getUTCMonth() + 1,
          year: now.getUTCFullYear(),
        }),
      };
    }
    if (timeRange.preset === "last_7d") {
      return { end: now, start: fromEpochMillis(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
    }
    if (timeRange.preset === "last_30d") {
      return { end: now, start: fromEpochMillis(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
    }
    if (timeRange.preset === "last_90d") {
      return { end: now, start: fromEpochMillis(now.getTime() - 90 * 24 * 60 * 60 * 1000) };
    }
    if (timeRange.preset === "last_365d") {
      return { end: now, start: fromEpochMillis(now.getTime() - 365 * 24 * 60 * 60 * 1000) };
    }
    if (timeRange.preset === "mtd") {
      return {
        end: now,
        start: fromUtcParts({ day: 1, month: now.getUTCMonth() + 1, year: now.getUTCFullYear() }),
      };
    }
    if (timeRange.preset === "qtd") {
      const quarter = Math.floor(now.getUTCMonth() / 3);
      return {
        end: now,
        start: fromUtcParts({ day: 1, month: quarter * 3 + 1, year: now.getUTCFullYear() }),
      };
    }
    if (timeRange.preset === "ytd") {
      return {
        end: now,
        start: fromUtcParts({ day: 1, month: 1, year: now.getUTCFullYear() }),
      };
    }
    if (timeRange.preset === "custom") {
      if (timeRange.start > timeRange.end) {
        return yield* Effect.fail(
          new InvalidTimeRangeError({ message: "start must be before end" }),
        );
      }
      return { end: truncateToSecond(timeRange.end), start: truncateToSecond(timeRange.start) };
    }
    return yield* Effect.die("Unreachable analytics time-range preset");
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
}

const ensureSupportedField = (field: string, supportedFields: readonly string[]) => {
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

const toArray = (value: Option.Option<FilterValue>): ReadonlyArray<PrimitiveFilterValue> =>
  Option.match(value, {
    onNone: () => [],
    onSome: (item) => {
      if (P.isString(item) || P.isNumber(item) || P.isBoolean(item) || item === null) return [item];
      return item;
    },
  });

const toStringArray = (field: SupportedRevenueFilterField, value: Option.Option<FilterValue>) => {
  const values = toArray(value);
  const strings = values.filter((item) => P.isString(item));
  if (strings.length !== values.length) {
    return Effect.fail(
      new InvalidAnalyticsQueryError({ message: `Filter ${field} expects string values` }),
    );
  }
  return Effect.succeed(strings);
};

const toNumberArray = (field: SupportedRevenueFilterField, value: Option.Option<FilterValue>) => {
  const values = toArray(value);
  const numbers = values.filter((item) => P.isNumber(item));
  if (numbers.length !== values.length) {
    return Effect.fail(
      new InvalidAnalyticsQueryError({ message: `Filter ${field} expects numeric values` }),
    );
  }
  return Effect.succeed(numbers);
};

const intersect = <T>(left: Option.Option<T[]>, right: Option.Option<T[]>) => {
  if (Option.isNone(left)) return right;
  if (Option.isNone(right)) return left;
  return Option.some(left.value.filter((item) => right.value.includes(item)));
};

const union = <T>(left: Option.Option<T[]>, right: Option.Option<T[]>) => {
  if (Option.isNone(left)) return right;
  if (Option.isNone(right)) return left;
  const initial: { readonly seen: HashSet.HashSet<T>; readonly values: T[] } = {
    seen: HashSet.empty(),
    values: [],
  };
  return Option.some(Arr.reduce(
    [...left.value, ...right.value],
    initial,
    (state, value) => {
      if (HashSet.has(state.seen, value)) return state;
      return { seen: HashSet.add(state.seen, value), values: [...state.values, value] };
    },
  ).values);
};

const mergeAndConstraints = (left: PartialConstraints, right: PartialConstraints) => ({
  productIds: Option.getOrUndefined(
    intersect(Option.fromNullishOr(left.productIds), Option.fromNullishOr(right.productIds)),
  ),
  projectIds: Option.getOrUndefined(
    intersect(Option.fromNullishOr(left.projectIds), Option.fromNullishOr(right.projectIds)),
  ),
  providerEnvironments: Option.getOrUndefined(
    intersect(
      Option.fromNullishOr(left.providerEnvironments),
      Option.fromNullishOr(right.providerEnvironments),
    ),
  ),
});

/**
 * The compiled representation can only express conjunction across fields, so an
 * OR is legal only when both arms constrain the same single field — anything
 * else would silently narrow to an AND.
 */
const mergeOrConstraints = (left: PartialConstraints, right: PartialConstraints) => {
  const fields = HashSet.fromIterable([
    ...((left.productIds || right.productIds) ? ["productIds"] : []),
    ...((left.projectIds || right.projectIds) ? ["projectIds"] : []),
    ...((left.providerEnvironments || right.providerEnvironments)
      ? ["providerEnvironments"]
      : []),
  ]);

  if (HashSet.size(fields) > 1) {
    return Effect.fail(
      new UnsupportedAnalyticsFilterError({
        field: "or",
        message: "OR filters are only supported within a single field",
      }),
    );
  }

  return Effect.succeed({
    productIds: Option.getOrUndefined(
      union(Option.fromNullishOr(left.productIds), Option.fromNullishOr(right.productIds)),
    ),
    projectIds: Option.getOrUndefined(
      union(Option.fromNullishOr(left.projectIds), Option.fromNullishOr(right.projectIds)),
    ),
    providerEnvironments: Option.getOrUndefined(
      union(
        Option.fromNullishOr(left.providerEnvironments),
        Option.fromNullishOr(right.providerEnvironments),
      ),
    ),
  });
};

const compilePredicate = ({
  availableProjectIds,
  filter,
}: {
  availableProjectIds: string[];
  filter: Extract<AnalyticsFilter, { type: "predicate" }>;
}) =>
  Effect.gen(function* () {
    const { field, op, value } = filter;

    if (field === "project.id") {
      if (op === "eq" || op === "in") {
        const ids = yield* toStringArray(field, Option.fromNullishOr(value));
        return { projectIds: availableProjectIds.filter((id) => ids.includes(id)) };
      }
      if (op === "neq" || op === "not_in") {
        const ids = yield* toStringArray(field, Option.fromNullishOr(value));
        return { projectIds: availableProjectIds.filter((id) => !ids.includes(id)) };
      }
    }
    if (field === "product.id" && (op === "eq" || op === "in")) {
      return { productIds: yield* toStringArray(field, Option.fromNullishOr(value)) };
    }
    if (field === "provider.environment" && (op === "eq" || op === "in")) {
      return {
        providerEnvironments: yield* toNumberArray(field, Option.fromNullishOr(value)),
      };
      }

    return yield* Effect.fail(
      new UnsupportedAnalyticsFilterError({
        field,
        message: `Operator ${op} is not supported for ${field} in this PoC`,
      }),
    );
  });

type PredicateOp = Extract<AnalyticsFilter, { type: "predicate" }>["op"];

/** Inverts the operators a NOT filter wraps; non-invertible operators pass through. */
const negatePredicateOp = (op: PredicateOp) => {
  if (op === "eq") return "neq";
  if (op === "neq") return "eq";
  if (op === "in") return "not_in";
  if (op === "not_in") return "in";
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
    if (filter.type === "predicate") {
      yield* ensureSupportedField(filter.field, supportedFields);
      return yield* compilePredicate({ availableProjectIds, filter });
    }
    if (filter.type === "and") {
      const constraints = yield* Effect.forEach(
        filter.filters,
        (child) => compileNode({ availableProjectIds, filter: child, supportedFields }),
        { concurrency: 1 },
      );
      return Arr.reduce(constraints, {}, mergeAndConstraints);
    }
    if (filter.type === "or") {
      const constraints = yield* Effect.forEach(
        filter.filters,
        (child) => compileNode({ availableProjectIds, filter: child, supportedFields }),
        { concurrency: 1 },
      );
      const initial: Effect.Effect<PartialConstraints, UnsupportedAnalyticsFilterError> =
        Effect.succeed({});
      return yield* Arr.reduce(
        constraints,
        initial,
        (current, right) => current.pipe(Effect.flatMap((left) => mergeOrConstraints(left, right))),
      );
    }
    if (filter.type === "not") {
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
    return yield* Effect.die("Unreachable analytics filter node");
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
    };
  });
