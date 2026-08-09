import { ClickhouseWebClient } from "@voidhash/clickhouse-db/clickhouse-client-web";
import {
  Db,
  analyticsCohortMembers,
  analyticsCohorts,
  analyticsDashboardItems,
  analyticsDashboards,
  analyticsInsights,
  analyticsSavedQuery,
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  persons,
} from "@voidhash/db";
import { constant } from "@voidhash/lib/lang";
import type {
  AnalyticsActorType,
  AnalyticsCohortType,
  AnalyticsDashboardItemLayoutType,
  AnalyticsDashboardType,
  AnalyticsFilterType,
  AnalyticsTrendsComparisonType,
  AnalyticsTrendsFormulaType,
  CustomAnalyticsInsightQueryType,
  QueryCustomAnalyticsInsightResponseType,
  SavedAnalyticsInsightType,
  SavedVoidQlInsightType,
} from "@voidhash/rpc";
import { Context, DateTime, Effect, Layer, Option } from "effect";

import { InvalidAnalyticsQueryError, resolveTimeRange } from "../../domain/analytics/Analytics.ts";
import { AuthSession } from "../../domain/auth/Auth.ts";
import { generateId } from "../../utils/generate-id.ts";
import { checkProjectPermission } from "../../utils/permissions.ts";
import { AnalyticsServiceError } from "./AnalyticsService.ts";
import {
  type EventLifecyclePoint,
  type EventPathLink,
  type EventRetentionCohort,
  type EventStickinessBucket,
  getEventFunnelBreakdownCounts,
  getEventFunnelCounts,
  getEventLifecyclePoints,
  getEventPathLinks,
  getEventPersonDrilldown,
  getEventRetentionCohorts,
  getEventStickinessBuckets,
  getEventTrendSeries,
} from "./clickhouse-accessor.ts";

type AnalyticsInsightRow = typeof analyticsInsights.$inferSelect;
type AnalyticsDashboardRow = typeof analyticsDashboards.$inferSelect;
type AnalyticsCohortRow = typeof analyticsCohorts.$inferSelect;
type AnalyticsSavedQueryRow = typeof analyticsSavedQuery.$inferSelect;

/** Builds a `Date` without the ambient constructor, from epoch millis or another date. */
const dateFrom = (input: Date | number): Date => DateTime.toDateUtc(DateTime.makeUnsafe(input));

/** Wall-clock timestamp used for row bookkeeping columns. */
const currentTimestamp = (): Date => DateTime.toDateUtc(DateTime.nowUnsafe());

const CUSTOM_INSIGHT_KINDS = new Set([
  "trends",
  "funnels",
  "retention",
  "paths",
  "stickiness",
  "lifecycle",
]);

/**
 * Narrows the untyped `jsonb` definition column to the saved insight query union.
 *
 * Rows are only ever written from an already validated RPC payload, so the tag
 * check is enough to trust the stored shape.
 */
const isCustomAnalyticsInsightQuery = (
  value: unknown,
): value is CustomAnalyticsInsightQueryType =>
  typeof value === "object" &&
  value !== null &&
  "kind" in value &&
  typeof value.kind === "string" &&
  CUSTOM_INSIGHT_KINDS.has(value.kind);

const toSavedInsight = (row: AnalyticsInsightRow): Effect.Effect<SavedAnalyticsInsightType> =>
  Effect.gen(function* () {
    if (!isCustomAnalyticsInsightQuery(row.definition)) {
      return yield* Effect.die(`Analytics insight ${row.id} has a malformed definition`);
    }
    const definition = row.definition;
    return {
      createdAt: row.createdAt,
      createdBy: row.createdBy,
      definition,
      description: row.description,
      id: row.id,
      kind: definition.kind,
      name: row.name,
      organizationId: row.organizationId,
      projectId: row.projectId,
      updatedAt: row.updatedAt,
    };
  });

const toSavedVoidQlInsight = (row: AnalyticsSavedQueryRow): SavedVoidQlInsightType => ({
  createdAt: row.createdAt,
  createdBy: row.createdBy,
  id: row.id,
  name: row.name,
  organizationId: row.organizationId,
  schemaVersion: row.schemaVersion,
  text: row.voidqlText,
  updatedAt: row.updatedAt,
});

export type ExecutableTrendsDefinition = Extract<
  CustomAnalyticsInsightQueryType,
  { readonly kind: "trends" }
>;
export type ExecutableFunnelsDefinition = Extract<
  CustomAnalyticsInsightQueryType,
  { readonly kind: "funnels" }
>;
export type ExecutableRetentionDefinition = Extract<
  CustomAnalyticsInsightQueryType,
  { readonly kind: "retention" }
>;
export type ExecutablePathsDefinition = Extract<
  CustomAnalyticsInsightQueryType,
  { readonly kind: "paths" }
>;
export type ExecutableStickinessDefinition = Extract<
  CustomAnalyticsInsightQueryType,
  { readonly kind: "stickiness" }
>;
export type ExecutableLifecycleDefinition = Extract<
  CustomAnalyticsInsightQueryType,
  { readonly kind: "lifecycle" }
>;

type TrendsInsightResult = Extract<
  QueryCustomAnalyticsInsightResponseType,
  { readonly kind: "trends" }
>;
type ResolvedTrendsTimeRange = TrendsInsightResult["resolvedTimeRange"];

const shiftUtcYear = (value: Date, years: number): Date => {
  const targetYear = value.getUTCFullYear() + years;
  const lastDay = dateFrom(Date.UTC(targetYear, value.getUTCMonth() + 1, 0)).getUTCDate();
  return dateFrom(
    Date.UTC(
      targetYear,
      value.getUTCMonth(),
      Math.min(value.getUTCDate(), lastDay),
      value.getUTCHours(),
      value.getUTCMinutes(),
      value.getUTCSeconds(),
    ),
  );
};

/** Resolve the date window used for a Trends comparison. */
export const resolveTrendsComparisonTimeRange = (
  comparison: AnalyticsTrendsComparisonType,
  current: ResolvedTrendsTimeRange,
): ResolvedTrendsTimeRange => {
  if (comparison === "previous_year") {
    return { end: shiftUtcYear(current.end, -1), start: shiftUtcYear(current.start, -1) };
  }

  const duration = current.end.getTime() - current.start.getTime();
  return {
    end: dateFrom(current.start.getTime() - 1_000),
    start: dateFrom(current.start.getTime() - duration),
  };
};

/** Resolve a Trends comparison window when the definition asks for one. */
const resolveOptionalTrendsComparisonTimeRange = (
  comparison: AnalyticsTrendsComparisonType | undefined,
  current: ResolvedTrendsTimeRange,
): ResolvedTrendsTimeRange | undefined => {
  if (comparison === undefined) return undefined;
  return resolveTrendsComparisonTimeRange(comparison, current);
};

/** Key suffix that distinguishes a comparison period's series from the current one. */
const trendsComparisonKeySuffix = (
  comparison: "current" | AnalyticsTrendsComparisonType,
): string => {
  if (comparison === "current") return "";
  return `:comparison:${comparison}`;
};

/** Human-readable name for a Trends comparison period. */
const trendsComparisonLabel = (
  comparison: "current" | AnalyticsTrendsComparisonType,
): string | undefined => {
  if (comparison === "previous_period") return "previous period";
  if (comparison === "previous_year") return "previous year";
  return undefined;
};

const labelWithComparison = (
  label: string,
  comparison: "current" | AnalyticsTrendsComparisonType,
): string => {
  const suffix = trendsComparisonLabel(comparison);
  if (suffix === undefined) return label;
  return `${label} (${suffix})`;
};

const keyWithBreakdown = (key: string, breakdownValue: string | undefined): string => {
  if (breakdownValue === undefined) return key;
  return `${key}:${breakdownValue}`;
};

const labelWithBreakdown = (label: string, breakdownValue: string | undefined): string => {
  if (breakdownValue === undefined) return label;
  return `${label} · ${breakdownValue || "(empty)"}`;
};

const stripSuffix = (key: string, suffix: string): string => {
  if (suffix.length === 0) return key;
  return key.slice(0, -suffix.length);
};

const breakdownValueFromKey = (sourceKey: string, seriesKey: string): string | undefined => {
  if (sourceKey === seriesKey) return undefined;
  return sourceKey.slice(seriesKey.length + 1);
};

/** Divide while treating an empty denominator as a zero rate. */
const safeRatio = (numerator: number, denominator: number): number => {
  if (denominator === 0) return 0;
  return numerator / denominator;
};

const startOfTrendsBucket = (
  value: Date,
  granularity: ExecutableTrendsDefinition["granularity"],
): Date => {
  const bucket = dateFrom(value);
  bucket.setUTCMilliseconds(0);
  if (granularity === "hour") bucket.setUTCMinutes(0, 0, 0);
  else {
    bucket.setUTCHours(0, 0, 0, 0);
    if (granularity === "week") {
      bucket.setUTCDate(bucket.getUTCDate() - ((bucket.getUTCDay() + 6) % 7));
    } else if (granularity === "month") bucket.setUTCDate(1);
    else if (granularity === "quarter") {
      bucket.setUTCMonth(Math.floor(bucket.getUTCMonth() / 3) * 3, 1);
    } else if (granularity === "year") bucket.setUTCMonth(0, 1);
  }
  return bucket;
};

const nextTrendsBucket = (
  value: Date,
  granularity: ExecutableTrendsDefinition["granularity"],
): Date => {
  const next = dateFrom(value);
  if (granularity === "hour") next.setUTCHours(next.getUTCHours() + 1);
  else if (granularity === "day") next.setUTCDate(next.getUTCDate() + 1);
  else if (granularity === "week") next.setUTCDate(next.getUTCDate() + 7);
  else if (granularity === "month") next.setUTCMonth(next.getUTCMonth() + 1);
  else if (granularity === "quarter") next.setUTCMonth(next.getUTCMonth() + 3);
  else next.setUTCFullYear(next.getUTCFullYear() + 1);
  return next;
};

const trendsBuckets = (
  range: ResolvedTrendsTimeRange,
  granularity: ExecutableTrendsDefinition["granularity"],
): Date[] => {
  const buckets: Date[] = [];
  let cursor = startOfTrendsBucket(range.start, granularity);
  while (cursor <= range.end && buckets.length < 20_000) {
    buckets.push(cursor);
    cursor = nextTrendsBucket(cursor, granularity);
  }
  return buckets;
};

/** Align comparison points to the current x-axis by bucket position. */
export const alignTrendsComparisonPoints = (
  points: TrendsInsightResult["series"][number]["points"],
  current: ResolvedTrendsTimeRange,
  comparison: ResolvedTrendsTimeRange,
  granularity: ExecutableTrendsDefinition["granularity"],
): TrendsInsightResult["series"][number]["points"] => {
  const currentBuckets = trendsBuckets(current, granularity);
  const comparisonBuckets = trendsBuckets(comparison, granularity);
  const currentByComparisonTimestamp = new Map(
    comparisonBuckets.map((bucket, index) => [bucket.getTime(), currentBuckets[index]]),
  );
  return points.flatMap((point) => {
    const timestamp = currentByComparisonTimestamp.get(point.timestamp.getTime());
    if (timestamp === undefined) return [];
    return [{ ...point, timestamp }];
  });
};

/** Fill absent Trends buckets with zero so charts and formulas share a complete time axis. */
export const fillTrendsSeriesPoints = (
  points: TrendsInsightResult["series"][number]["points"],
  range: ResolvedTrendsTimeRange,
  granularity: ExecutableTrendsDefinition["granularity"],
): TrendsInsightResult["series"][number]["points"] => {
  const values = new Map(points.map((point) => [point.timestamp.getTime(), point.value]));
  return trendsBuckets(range, granularity).map((timestamp) => ({
    timestamp,
    value: values.get(timestamp.getTime()) ?? 0,
  }));
};

/** Apply trailing smoothing, cumulative values, and weekend removal to a complete Trends series. */
export const applyTrendsPresentation = (
  points: TrendsInsightResult["series"][number]["points"],
  options: {
    readonly cumulative?: boolean;
    readonly hideWeekends?: boolean;
    readonly smoothingWindow?: number;
  },
): TrendsInsightResult["series"][number]["points"] => {
  const smoothingWindow = Math.max(1, options.smoothingWindow ?? 1);
  let presented = points.map((point, index) => {
    if (smoothingWindow === 1) return point;
    const window = points.slice(Math.max(0, index - smoothingWindow + 1), index + 1);
    return {
      ...point,
      value: window.reduce((sum, candidate) => sum + candidate.value, 0) / window.length,
    };
  });
  if (options.cumulative) {
    let total = 0;
    presented = presented.map((point) => {
      total += point.value;
      return { ...point, value: total };
    });
  }
  if (options.hideWeekends) {
    return presented.filter((point) => ![0, 6].includes(point.timestamp.getUTCDay()));
  }
  return presented;
};

type TrendsFormulaNode =
  | { readonly kind: "number"; readonly value: number }
  | { readonly key: string; readonly kind: "series" }
  | {
      readonly kind: "unary";
      readonly operand: TrendsFormulaNode;
      readonly operator: "+" | "-";
    }
  | {
      readonly kind: "binary";
      readonly left: TrendsFormulaNode;
      readonly operator: "+" | "-" | "*" | "/" | "%" | "**";
      readonly right: TrendsFormulaNode;
    };

type TrendsFormulaToken =
  | { readonly kind: "identifier"; readonly value: string }
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "operator"; readonly value: "+" | "-" | "*" | "/" | "%" | "**" }
  | { readonly kind: "left_parenthesis" | "right_parenthesis" };

const TRENDS_FORMULA_OPERATORS = constant(["+", "-", "*", "/", "%"]);

const arithmeticOperator = (
  character: string | undefined,
): (typeof TRENDS_FORMULA_OPERATORS)[number] | undefined =>
  TRENDS_FORMULA_OPERATORS.find((operator) => operator === character);

const tokenizeTrendsFormula = (
  source: string,
): Effect.Effect<TrendsFormulaToken[], InvalidAnalyticsQueryError> =>
  Effect.gen(function* () {
    const tokens: TrendsFormulaToken[] = [];
    let offset = 0;
    while (offset < source.length) {
      const character = source[offset];
      if (character && /\s/u.test(character)) {
        offset += 1;
        continue;
      }
      const remainder = source.slice(offset);
      const number = /^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/iu.exec(remainder)?.[0];
      const identifier = /^[a-z][a-z0-9_]*/iu.exec(remainder)?.[0];
      const operator = arithmeticOperator(character);
      if (number) {
        const value = Number(number);
        if (!Number.isFinite(value)) {
          return yield* Effect.fail(
            new InvalidAnalyticsQueryError({ message: "Formula numbers must be finite" }),
          );
        }
        tokens.push({ kind: "number", value });
        offset += number.length;
      } else if (identifier) {
        tokens.push({ kind: "identifier", value: identifier.toLowerCase() });
        offset += identifier.length;
      } else if (remainder.startsWith("**")) {
        tokens.push({ kind: "operator", value: "**" });
        offset += 2;
      } else if (operator !== undefined) {
        tokens.push({ kind: "operator", value: operator });
        offset += 1;
      } else if (character === "(") {
        tokens.push({ kind: "left_parenthesis" });
        offset += 1;
      } else if (character === ")") {
        tokens.push({ kind: "right_parenthesis" });
        offset += 1;
      } else {
        return yield* Effect.fail(
          new InvalidAnalyticsQueryError({
            message: `Unexpected character at position ${offset + 1}`,
          }),
        );
      }
      if (tokens.length > 128) {
        return yield* Effect.fail(
          new InvalidAnalyticsQueryError({ message: "Formula is too complex" }),
        );
      }
    }
    return tokens;
  });

/** Recursive-descent parser over the tokenized Trends formula grammar. */
const parseTrendsFormulaTokens = (
  tokens: ReadonlyArray<TrendsFormulaToken>,
): Effect.Effect<TrendsFormulaNode, InvalidAnalyticsQueryError> => {
  let offset = 0;

  const current = (): TrendsFormulaToken | undefined => tokens[offset];

  const consume = (): Effect.Effect<TrendsFormulaToken, InvalidAnalyticsQueryError> => {
    const token = current();
    if (!token) {
      return Effect.fail(
        new InvalidAnalyticsQueryError({ message: "Formula ended unexpectedly" }),
      );
    }
    offset += 1;
    return Effect.succeed(token);
  };

  const parsePrimary = (): Effect.Effect<TrendsFormulaNode, InvalidAnalyticsQueryError> =>
    Effect.gen(function* () {
      const token = yield* consume();
      if (token.kind === "number") return { kind: "number", value: token.value };
      if (token.kind === "identifier") return { key: token.value, kind: "series" };
      if (token.kind === "left_parenthesis") {
        const expression = yield* parseAdditive();
        const closing = yield* consume();
        if (closing.kind !== "right_parenthesis") {
          return yield* Effect.fail(
            new InvalidAnalyticsQueryError({
              message: "Formula has an unmatched parenthesis",
            }),
          );
        }
        return expression;
      }
      return yield* Effect.fail(
        new InvalidAnalyticsQueryError({
          message: "Expected a number, series, or parenthesized expression",
        }),
      );
    });

  const parsePower = (): Effect.Effect<TrendsFormulaNode, InvalidAnalyticsQueryError> =>
    Effect.gen(function* () {
      const left = yield* parsePrimary();
      const token = current();
      if (token?.kind === "operator" && token.value === "**") {
        yield* consume();
        return { kind: "binary", left, operator: "**", right: yield* parseUnary() };
      }
      return left;
    });

  const parseUnary = (): Effect.Effect<TrendsFormulaNode, InvalidAnalyticsQueryError> =>
    Effect.gen(function* () {
      const token = current();
      if (token?.kind === "operator" && (token.value === "+" || token.value === "-")) {
        yield* consume();
        return { kind: "unary", operand: yield* parseUnary(), operator: token.value };
      }
      return yield* parsePower();
    });

  const parseMultiplicative = (): Effect.Effect<TrendsFormulaNode, InvalidAnalyticsQueryError> =>
    Effect.gen(function* () {
      let left = yield* parseUnary();
      while (true) {
        const operator = current();
        if (
          operator?.kind !== "operator" ||
          (operator.value !== "*" && operator.value !== "/" && operator.value !== "%")
        ) {
          break;
        }
        yield* consume();
        const right = yield* parseUnary();
        left = {
          kind: "binary",
          left,
          operator: operator.value,
          right,
        };
      }
      return left;
    });

  const parseAdditive = (): Effect.Effect<TrendsFormulaNode, InvalidAnalyticsQueryError> =>
    Effect.gen(function* () {
      let left = yield* parseMultiplicative();
      while (true) {
        const operator = current();
        if (operator?.kind !== "operator" || (operator.value !== "+" && operator.value !== "-")) {
          break;
        }
        yield* consume();
        const right = yield* parseMultiplicative();
        left = {
          kind: "binary",
          left,
          operator: operator.value,
          right,
        };
      }
      return left;
    });

  return Effect.gen(function* () {
    if (tokens.length === 0) {
      return yield* Effect.fail(
        new InvalidAnalyticsQueryError({ message: "Formula cannot be empty" }),
      );
    }
    const expression = yield* parseAdditive();
    if (current()) {
      return yield* Effect.fail(
        new InvalidAnalyticsQueryError({ message: "Unexpected token after formula" }),
      );
    }
    return expression;
  });
};

const collectTrendsFormulaReferences = (node: TrendsFormulaNode, references: Set<string>): void => {
  if (node.kind === "series") references.add(node.key);
  else if (node.kind === "unary") collectTrendsFormulaReferences(node.operand, references);
  else if (node.kind === "binary") {
    collectTrendsFormulaReferences(node.left, references);
    collectTrendsFormulaReferences(node.right, references);
  }
};

const applyTrendsFormulaOperator = (
  operator: Extract<TrendsFormulaNode, { readonly kind: "binary" }>["operator"],
  left: number,
  right: number,
): number => {
  if (operator === "+") return left + right;
  if (operator === "-") return left - right;
  if (operator === "*") return left * right;
  if (operator === "/") {
    if (right === 0) return 0;
    return left / right;
  }
  if (operator === "%") {
    if (right === 0) return 0;
    return left % right;
  }
  return left ** right;
};

const evaluateTrendsFormulaNode = (
  node: TrendsFormulaNode,
  values: ReadonlyMap<string, number>,
): number => {
  if (node.kind === "number") return node.value;
  if (node.kind === "series") return values.get(node.key) ?? 0;
  if (node.kind === "unary") {
    const value = evaluateTrendsFormulaNode(node.operand, values);
    if (node.operator === "-") return -value;
    return value;
  }
  const left = evaluateTrendsFormulaNode(node.left, values);
  const right = evaluateTrendsFormulaNode(node.right, values);
  const result = applyTrendsFormulaOperator(node.operator, left, right);
  if (Number.isFinite(result)) return result;
  return 0;
};

const compileTrendsFormula = (
  formula: AnalyticsTrendsFormulaType,
  allowedSeries: ReadonlySet<string>,
): Effect.Effect<TrendsFormulaNode, InvalidAnalyticsQueryError> =>
  Effect.gen(function* () {
    const node = yield* tokenizeTrendsFormula(formula.expression).pipe(
      Effect.flatMap(parseTrendsFormulaTokens),
      Effect.mapError(
        (error) =>
          new InvalidAnalyticsQueryError({
            message: `Invalid Trends formula ${formula.key}: ${error.message}`,
          }),
      ),
    );
    const references = new Set<string>();
    collectTrendsFormulaReferences(node, references);
    const missing = [...references].filter((reference) => !allowedSeries.has(reference));
    if (missing.length > 0) {
      return yield* Effect.fail(
        new InvalidAnalyticsQueryError({
          message: `Trends formula ${formula.key} references unknown series: ${missing.join(", ")}`,
        }),
      );
    }
    return node;
  });

const CUSTOM_PROPERTY_PREFIX = "event.properties.";
const CUSTOM_EVENT_FIELDS = new Set(["event.name", "person.id"]);
const PROPERTY_AGGREGATIONS = new Set([
  "property_sum",
  "property_average",
  "property_minimum",
  "property_maximum",
  "property_median",
  "property_p75",
  "property_p90",
  "property_p95",
  "property_p99",
]);

const validateCustomEventField = (
  field: string,
): Effect.Effect<void, InvalidAnalyticsQueryError> => {
  if (CUSTOM_EVENT_FIELDS.has(field)) return Effect.void;
  if (
    field.startsWith(CUSTOM_PROPERTY_PREFIX) &&
    field.length > CUSTOM_PROPERTY_PREFIX.length &&
    field.length <= CUSTOM_PROPERTY_PREFIX.length + 128 &&
    !Array.from(field).some((character) => character.charCodeAt(0) < 32)
  ) {
    return Effect.void;
  }
  return Effect.fail(
    new InvalidAnalyticsQueryError({
      message: `Unsupported custom analytics field: ${field}`,
    }),
  );
};

const validateCustomEventFilter = (
  filter: AnalyticsFilterType,
  depth = 0,
): Effect.Effect<number, InvalidAnalyticsQueryError> =>
  Effect.gen(function* () {
    if (depth > 8) {
      return yield* Effect.fail(
        new InvalidAnalyticsQueryError({
          message: "Custom analytics filters are nested too deeply",
        }),
      );
    }
    if (filter.type === "not") return yield* validateCustomEventFilter(filter.filter, depth + 1);
    // The `and`/`or` group shares one union member, so it is narrowed by excluding
    // the other tags rather than by testing its own tag.
    if (filter.type !== "predicate") {
      if (filter.filters.length === 0) {
        return yield* Effect.fail(
          new InvalidAnalyticsQueryError({
            message: "Custom analytics filter groups cannot be empty",
          }),
        );
      }
      const counts = yield* Effect.all(
        filter.filters.map((child) => validateCustomEventFilter(child, depth + 1)),
      );
      return counts.reduce((total, count) => total + count, 0);
    }

    const predicate = filter;
    yield* validateCustomEventField(predicate.field);
    if (["gt", "gte", "lt", "lte"].includes(predicate.op)) {
      return yield* Effect.fail(
        new InvalidAnalyticsQueryError({
          message: `Custom analytics does not yet support the ${predicate.op} property operator`,
        }),
      );
    }
    if (predicate.op === "exists") return 1;
    if ((predicate.op === "in" || predicate.op === "not_in") && !Array.isArray(predicate.value)) {
      return yield* Effect.fail(
        new InvalidAnalyticsQueryError({
          message: `${predicate.op} requires an array value`,
        }),
      );
    }
    if (predicate.value === undefined || predicate.value === null) {
      return yield* Effect.fail(
        new InvalidAnalyticsQueryError({ message: `${predicate.op} requires a value` }),
      );
    }
    return 1;
  });

/** Validate the currently executable subset of custom analytics definitions. */
export const validateExecutableTrendsDefinition = (
  definition: CustomAnalyticsInsightQueryType,
): Effect.Effect<ExecutableTrendsDefinition, InvalidAnalyticsQueryError> =>
  Effect.gen(function* () {
    if (definition.kind !== "trends") {
      return yield* Effect.fail(
        new InvalidAnalyticsQueryError({
          message: `${definition.kind} execution is not available yet`,
        }),
      );
    }
    if (definition.breakdown) yield* validateCustomEventField(definition.breakdown.field);
    if (
      definition.smoothingWindow !== undefined &&
      (!Number.isSafeInteger(definition.smoothingWindow) || definition.granularity !== "day")
    ) {
      return yield* Effect.fail(
        new InvalidAnalyticsQueryError({
          message: "Trends smoothing requires a whole-day window between 1 and 28",
        }),
      );
    }
    if (definition.hideWeekends && definition.granularity !== "day") {
      return yield* Effect.fail(
        new InvalidAnalyticsQueryError({ message: "Weekend hiding requires daily granularity" }),
      );
    }
    if (
      definition.display === "number" &&
      (definition.cumulative || definition.hideWeekends || (definition.smoothingWindow ?? 1) > 1)
    ) {
      return yield* Effect.fail(
        new InvalidAnalyticsQueryError({
          message: "Total-value Trends do not support time-series presentation options",
        }),
      );
    }
    const seriesKeys = new Set(definition.series.map((series) => series.key.toLowerCase()));
    if (seriesKeys.size !== definition.series.length) {
      return yield* Effect.fail(
        new InvalidAnalyticsQueryError({ message: "Trends series keys must be unique" }),
      );
    }
    if (definition.formulas) {
      if (definition.formulas.length === 0 || definition.formulas.length > 8) {
        return yield* Effect.fail(
          new InvalidAnalyticsQueryError({ message: "Trends supports between 1 and 8 formulas" }),
        );
      }
      const formulaKeys = new Set(definition.formulas.map((formula) => formula.key.toLowerCase()));
      if (
        formulaKeys.size !== definition.formulas.length ||
        [...formulaKeys].some((key) => seriesKeys.has(key))
      ) {
        return yield* Effect.fail(
          new InvalidAnalyticsQueryError({
            message: "Trends formula keys must be unique and distinct from series keys",
          }),
        );
      }
      yield* Effect.all(
        definition.formulas.map((formula) => compileTrendsFormula(formula, seriesKeys)),
        { concurrency: 4 },
      );
    }
    let predicateCount = 0;
    for (const series of definition.series) {
      if (PROPERTY_AGGREGATIONS.has(series.aggregation)) {
        if (!series.mathProperty?.trim()) {
          return yield* Effect.fail(
            new InvalidAnalyticsQueryError({
              message: `${series.aggregation} requires an event property`,
            }),
          );
        }
        yield* validateCustomEventField(`${CUSTOM_PROPERTY_PREFIX}${series.mathProperty.trim()}`);
      } else if (series.mathProperty !== undefined) {
        return yield* Effect.fail(
          new InvalidAnalyticsQueryError({
            message: `${series.aggregation} does not use an event property`,
          }),
        );
      }
      if (series.filters) predicateCount += yield* validateCustomEventFilter(series.filters);
    }
    if (predicateCount > 20) {
      return yield* Effect.fail(
        new InvalidAnalyticsQueryError({ message: "Custom Trends supports at most 20 predicates" }),
      );
    }
    return definition;
  });

interface TrendsFormulaGroup {
  readonly breakdownValue?: string;
  readonly comparison: "current" | AnalyticsTrendsComparisonType;
  readonly series: Map<string, Map<number, number>>;
}

/** Build formula-only Trends series from the queried source series and their aligned buckets. */
export const buildTrendsFormulaSeries = (
  definition: ExecutableTrendsDefinition,
  sourceSeries: ReadonlyArray<TrendsInsightResult["series"][number]>,
): Effect.Effect<TrendsInsightResult["series"], InvalidAnalyticsQueryError> =>
  Effect.gen(function* () {
    if (!definition.formulas?.length) return [...sourceSeries];
    const allowedSeries = new Set(definition.series.map((series) => series.key.toLowerCase()));
    const compiled = yield* Effect.all(
      definition.formulas.map((formula) => compileTrendsFormula(formula, allowedSeries)),
      { concurrency: 4 },
    );
    const definitionsBySpecificity = [...definition.series].sort(
      (left, right) => right.key.length - left.key.length,
    );
    const groups = new Map<string, TrendsFormulaGroup>();

    for (const source of sourceSeries) {
      const comparison = source.comparison ?? "current";
      const sourceKey = stripSuffix(source.key, trendsComparisonKeySuffix(comparison));
      const definitionSeries = definitionsBySpecificity.find(
        (candidate) => sourceKey === candidate.key || sourceKey.startsWith(`${candidate.key}:`),
      );
      if (!definitionSeries) continue;
      const breakdownValue = breakdownValueFromKey(sourceKey, definitionSeries.key);
      const groupKey = `${comparison}\u0000${breakdownValue ?? ""}`;
      const breakdownFields: { breakdownValue?: string } = {};
      if (breakdownValue !== undefined) breakdownFields.breakdownValue = breakdownValue;
      const group = groups.get(groupKey) ?? {
        ...breakdownFields,
        comparison,
        series: new Map<string, Map<number, number>>(),
      };
      group.series.set(
        definitionSeries.key.toLowerCase(),
        new Map(source.points.map((point) => [point.timestamp.getTime(), point.value])),
      );
      groups.set(groupKey, group);
    }

    const result: Array<TrendsInsightResult["series"][number]> = [];
    for (const group of groups.values()) {
      const timestamps = new Set<number>();
      for (const points of group.series.values()) {
        for (const timestamp of points.keys()) timestamps.add(timestamp);
      }
      const sortedTimestamps = [...timestamps].sort((left, right) => left - right);
      for (const [index, formula] of definition.formulas.entries()) {
        const node = compiled[index];
        if (!node) continue;
        const formulaLabel = formula.label ?? `Formula (${formula.expression})`;
        result.push({
          comparison: group.comparison,
          key: `${keyWithBreakdown(formula.key, group.breakdownValue)}${trendsComparisonKeySuffix(group.comparison)}`,
          label: labelWithComparison(
            labelWithBreakdown(formulaLabel, group.breakdownValue),
            group.comparison,
          ),
          points: sortedTimestamps.map((timestamp) => {
            const values = new Map<string, number>();
            for (const seriesKey of allowedSeries) {
              values.set(seriesKey, group.series.get(seriesKey)?.get(timestamp) ?? 0);
            }
            return {
              timestamp: dateFrom(timestamp),
              value: evaluateTrendsFormulaNode(node, values),
            };
          }),
        });
      }
    }
    return result;
  });

/** Validate a funnel definition before lowering it to ClickHouse. */
export const validateExecutableFunnelsDefinition = (
  definition: CustomAnalyticsInsightQueryType,
): Effect.Effect<ExecutableFunnelsDefinition, InvalidAnalyticsQueryError> =>
  Effect.gen(function* () {
    if (definition.kind !== "funnels") {
      return yield* Effect.fail(
        new InvalidAnalyticsQueryError({
          message: `${definition.kind} is not a funnel definition`,
        }),
      );
    }
    if (definition.steps.length < 2 || definition.steps.length > 20) {
      return yield* Effect.fail(
        new InvalidAnalyticsQueryError({ message: "Funnels require between 2 and 20 steps" }),
      );
    }
    if (
      !Number.isSafeInteger(definition.conversionWindowSeconds) ||
      definition.conversionWindowSeconds < 1 ||
      definition.conversionWindowSeconds > 31_536_000
    ) {
      return yield* Effect.fail(
        new InvalidAnalyticsQueryError({
          message: "Funnel conversion windows must be whole seconds between 1 second and 365 days",
        }),
      );
    }
    if (definition.breakdown) {
      yield* validateCustomEventField(definition.breakdown.field);
      const attributionStep = definition.breakdownAttributionStep ?? 1;
      if (!Number.isSafeInteger(attributionStep) || attributionStep > definition.steps.length) {
        return yield* Effect.fail(
          new InvalidAnalyticsQueryError({
            message: "Funnel breakdown attribution must reference an existing step",
          }),
        );
      }
    } else if (definition.breakdownAttributionStep !== undefined) {
      return yield* Effect.fail(
        new InvalidAnalyticsQueryError({
          message: "Funnel breakdown attribution requires a breakdown field",
        }),
      );
    }
    let predicateCount = 0;
    for (const step of definition.steps) {
      if (step.filters) predicateCount += yield* validateCustomEventFilter(step.filters);
    }
    if (predicateCount > 20) {
      return yield* Effect.fail(
        new InvalidAnalyticsQueryError({ message: "Funnels support at most 20 predicates" }),
      );
    }
    return definition;
  });

type FunnelsInsightResult = Extract<
  QueryCustomAnalyticsInsightResponseType,
  { readonly kind: "funnels" }
>;

/** Convert monotonic funnel reach counts into display-ready step metrics. */
export const buildFunnelStepResults = (
  definition: ExecutableFunnelsDefinition,
  counts: ReadonlyArray<number>,
): FunnelsInsightResult["steps"] => {
  const entryCount = counts[0] ?? 0;
  return definition.steps.map((step, index) => {
    const count = counts[index] ?? 0;
    const previousCount = counts[index - 1] ?? count;
    const dropoffCount = Math.max(0, previousCount - count);
    return {
      conversionRate: safeRatio(count, entryCount),
      count,
      dropoffCount,
      dropoffRate: safeRatio(dropoffCount, previousCount),
      key: step.key,
      label: step.label ?? step.eventNames.join(" or "),
      step: index + 1,
    };
  });
};

/** Overall conversion from the funnel entry step to its final step. */
const funnelTotalConversionRate = (
  steps: FunnelsInsightResult["steps"],
  entryCount: number,
): number => safeRatio(steps.at(-1)?.count ?? 0, entryCount);

/** Validate a retention definition before lowering it to ClickHouse. */
export const validateExecutableRetentionDefinition = (
  definition: CustomAnalyticsInsightQueryType,
): Effect.Effect<ExecutableRetentionDefinition, InvalidAnalyticsQueryError> =>
  Effect.gen(function* () {
    if (definition.kind !== "retention") {
      return yield* Effect.fail(
        new InvalidAnalyticsQueryError({
          message: `${definition.kind} is not a retention definition`,
        }),
      );
    }
    const intervals = definition.intervals ?? 11;
    if (!Number.isSafeInteger(intervals) || intervals < 1 || intervals > 24) {
      return yield* Effect.fail(
        new InvalidAnalyticsQueryError({
          message: "Retention supports between 1 and 24 intervals",
        }),
      );
    }
    let predicateCount = 0;
    if (definition.start.filters) {
      predicateCount += yield* validateCustomEventFilter(definition.start.filters);
    }
    if (definition.returning.filters) {
      predicateCount += yield* validateCustomEventFilter(definition.returning.filters);
    }
    if (predicateCount > 20) {
      return yield* Effect.fail(
        new InvalidAnalyticsQueryError({ message: "Retention supports at most 20 predicates" }),
      );
    }
    return definition;
  });

type RetentionInsightResult = Extract<
  QueryCustomAnalyticsInsightResponseType,
  { readonly kind: "retention" }
>;

const retentionDenominator = (
  definition: ExecutableRetentionDefinition,
  cohort: EventRetentionCohort,
  interval: number,
): number => {
  if (definition.reference === "previous" && interval > 0) return cohort.counts[interval - 1] ?? 0;
  return cohort.cohortSize;
};

/** Convert retention counts into cohort- or previous-period-relative cells. */
export const buildRetentionCohortResults = (
  definition: ExecutableRetentionDefinition,
  cohorts: ReadonlyArray<EventRetentionCohort>,
): RetentionInsightResult["cohorts"] =>
  cohorts.map((cohort) => ({
    cells: cohort.counts.map((count, interval) => {
      const denominator = retentionDenominator(definition, cohort, interval);
      return {
        count,
        interval,
        rate: safeRatio(count, denominator),
      };
    }),
    cohortSize: cohort.cohortSize,
    cohortStart: cohort.cohortStart,
  }));

/** Validate a paths definition before lowering it to ClickHouse. */
export const validateExecutablePathsDefinition = (
  definition: CustomAnalyticsInsightQueryType,
): Effect.Effect<ExecutablePathsDefinition, InvalidAnalyticsQueryError> =>
  Effect.gen(function* () {
    if (definition.kind !== "paths") {
      return yield* Effect.fail(
        new InvalidAnalyticsQueryError({
          message: `${definition.kind} is not a paths definition`,
        }),
      );
    }
    if (
      !Number.isSafeInteger(definition.maxDepth) ||
      definition.maxDepth < 2 ||
      definition.maxDepth > 20
    ) {
      return yield* Effect.fail(
        new InvalidAnalyticsQueryError({ message: "Paths require between 2 and 20 steps" }),
      );
    }
    if (definition.startEventName !== undefined && definition.startEventName.trim().length === 0) {
      return yield* Effect.fail(
        new InvalidAnalyticsQueryError({
          message: "Paths start event cannot be empty",
        }),
      );
    }
    if (definition.endEventName !== undefined && definition.endEventName.trim().length === 0) {
      return yield* Effect.fail(
        new InvalidAnalyticsQueryError({
          message: "Paths end event cannot be empty",
        }),
      );
    }
    const sessionGapSeconds = definition.sessionGapSeconds ?? 1_800;
    if (
      !Number.isSafeInteger(sessionGapSeconds) ||
      sessionGapSeconds < 60 ||
      sessionGapSeconds > 86_400
    ) {
      return yield* Effect.fail(
        new InvalidAnalyticsQueryError({
          message: "Path session gaps must be whole seconds between 1 minute and 24 hours",
        }),
      );
    }
    const edgeLimit = definition.edgeLimit ?? 50;
    if (!Number.isSafeInteger(edgeLimit) || edgeLimit < 1 || edgeLimit > 200) {
      return yield* Effect.fail(
        new InvalidAnalyticsQueryError({ message: "Paths support between 1 and 200 links" }),
      );
    }
    if (
      definition.minEdgeCount !== undefined &&
      definition.maxEdgeCount !== undefined &&
      definition.minEdgeCount > definition.maxEdgeCount
    ) {
      return yield* Effect.fail(
        new InvalidAnalyticsQueryError({
          message: "Path minimum link count cannot exceed the maximum",
        }),
      );
    }
    if (definition.eventNames.length > 200 || (definition.excludeEventNames?.length ?? 0) > 200) {
      return yield* Effect.fail(
        new InvalidAnalyticsQueryError({ message: "Paths support at most 200 event selectors" }),
      );
    }
    if (definition.filters && (yield* validateCustomEventFilter(definition.filters)) > 20) {
      return yield* Effect.fail(
        new InvalidAnalyticsQueryError({ message: "Paths support at most 20 predicates" }),
      );
    }
    return definition;
  });

type PathsInsightResult = Extract<
  QueryCustomAnalyticsInsightResponseType,
  { readonly kind: "paths" }
>;

/** Normalize ClickHouse path links into the public insight result. */
export const buildPathsLinkResults = (
  links: ReadonlyArray<EventPathLink>,
): PathsInsightResult["links"] =>
  links.map((link) => ({
    averageTransitionSeconds: link.averageTransitionSeconds,
    count: link.count,
    source: link.source,
    sourceStep: link.sourceStep,
    target: link.target,
    targetStep: link.targetStep,
  }));

/** Validate a stickiness definition before lowering it to ClickHouse. */
export const validateExecutableStickinessDefinition = (
  definition: CustomAnalyticsInsightQueryType,
): Effect.Effect<ExecutableStickinessDefinition, InvalidAnalyticsQueryError> =>
  Effect.gen(function* () {
    if (definition.kind !== "stickiness") {
      return yield* Effect.fail(
        new InvalidAnalyticsQueryError({
          message: `${definition.kind} is not a stickiness definition`,
        }),
      );
    }
    if (definition.series.length > 8) {
      return yield* Effect.fail(
        new InvalidAnalyticsQueryError({ message: "Stickiness supports at most 8 series" }),
      );
    }
    const occurrenceCriteria = definition.occurrenceCriteria ?? { operator: "gte", value: 1 };
    if (
      !Number.isSafeInteger(occurrenceCriteria.value) ||
      occurrenceCriteria.value < 1 ||
      occurrenceCriteria.value > 10_000
    ) {
      return yield* Effect.fail(
        new InvalidAnalyticsQueryError({
          message: "Stickiness minimum occurrences must be a whole number between 1 and 10,000",
        }),
      );
    }
    let predicateCount = 0;
    for (const series of definition.series) {
      if (series.aggregation !== "unique_users") {
        return yield* Effect.fail(
          new InvalidAnalyticsQueryError({
            message: "Stickiness series must use unique users",
          }),
        );
      }
      if (series.filters) predicateCount += yield* validateCustomEventFilter(series.filters);
    }
    if (predicateCount > 20) {
      return yield* Effect.fail(
        new InvalidAnalyticsQueryError({ message: "Stickiness supports at most 20 predicates" }),
      );
    }
    return definition;
  });

const startOfStickinessInterval = (
  date: Date,
  interval: ExecutableStickinessDefinition["interval"],
): Date => {
  const value = dateFrom(date);
  value.setUTCMinutes(0, 0, 0);
  if (interval === "hour") return value;
  value.setUTCHours(0);
  if (interval === "day") return value;
  if (interval === "week") {
    value.setUTCDate(value.getUTCDate() - ((value.getUTCDay() + 6) % 7));
    return value;
  }
  value.setUTCDate(1);
  return value;
};

const stickinessIntervalMillis = (
  interval: ExecutableStickinessDefinition["interval"],
): number => {
  if (interval === "hour") return 3_600_000;
  if (interval === "week") return 604_800_000;
  return 86_400_000;
};

/** Count inclusive activity intervals represented by a resolved time range. */
export const countStickinessIntervals = (
  start: Date,
  end: Date,
  interval: ExecutableStickinessDefinition["interval"],
): number => {
  const from = startOfStickinessInterval(start, interval);
  const to = startOfStickinessInterval(end, interval);
  if (interval === "month") {
    return (
      (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + to.getUTCMonth() - from.getUTCMonth() + 1
    );
  }
  return Math.floor((to.getTime() - from.getTime()) / stickinessIntervalMillis(interval)) + 1;
};

const stickinessBucketCount = (
  raw: ReadonlyArray<EventStickinessBucket>,
  counts: ReadonlyMap<number, number>,
  computation: "cumulative" | "exact",
  intervals: number,
): number => {
  if (computation !== "cumulative") return counts.get(intervals) ?? 0;
  return raw.reduce((total, bucket) => {
    if (bucket.intervals >= intervals) return total + bucket.count;
    return total;
  }, 0);
};

/** Fill sparse frequency counts and optionally convert them to at-least-N counts. */
export const buildStickinessBuckets = (
  raw: ReadonlyArray<EventStickinessBucket>,
  computation: "cumulative" | "exact",
  maximumIntervals: number,
): EventStickinessBucket[] => {
  const counts = new Map(raw.map((bucket) => [bucket.intervals, bucket.count]));
  return Array.from({ length: maximumIntervals }, (_, offset) => {
    const intervals = offset + 1;
    return {
      count: stickinessBucketCount(raw, counts, computation, intervals),
      intervals,
    };
  });
};

/** Validate a lifecycle definition before lowering it to ClickHouse. */
export const validateExecutableLifecycleDefinition = (
  definition: CustomAnalyticsInsightQueryType,
): Effect.Effect<ExecutableLifecycleDefinition, InvalidAnalyticsQueryError> =>
  Effect.gen(function* () {
    if (definition.kind !== "lifecycle") {
      return yield* Effect.fail(
        new InvalidAnalyticsQueryError({
          message: `${definition.kind} is not a lifecycle definition`,
        }),
      );
    }
    if (definition.series.aggregation !== "unique_users") {
      return yield* Effect.fail(
        new InvalidAnalyticsQueryError({ message: "Lifecycle must use unique users" }),
      );
    }
    if (definition.series.filters) {
      const predicateCount = yield* validateCustomEventFilter(definition.series.filters);
      if (predicateCount > 20) {
        return yield* Effect.fail(
          new InvalidAnalyticsQueryError({ message: "Lifecycle supports at most 20 predicates" }),
        );
      }
    }
    if (definition.statuses && new Set(definition.statuses).size !== definition.statuses.length) {
      return yield* Effect.fail(
        new InvalidAnalyticsQueryError({ message: "Lifecycle statuses cannot be duplicated" }),
      );
    }
    return definition;
  });

type LifecycleInsightResult = Extract<
  QueryCustomAnalyticsInsightResponseType,
  { readonly kind: "lifecycle" }
>;

const nextLifecycleInterval = (
  value: Date,
  granularity: ExecutableLifecycleDefinition["granularity"],
): Date => {
  const next = dateFrom(value);
  if (granularity === "hour") next.setUTCHours(next.getUTCHours() + 1);
  else if (granularity === "day") next.setUTCDate(next.getUTCDate() + 1);
  else if (granularity === "week") next.setUTCDate(next.getUTCDate() + 7);
  else next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
};

/** Fill every selected lifecycle status across the inclusive resolved time range. */
export const buildLifecycleSeries = (
  points: ReadonlyArray<EventLifecyclePoint>,
  statuses: ReadonlyArray<EventLifecyclePoint["status"]>,
  start: Date,
  end: Date,
  granularity: ExecutableLifecycleDefinition["granularity"],
): LifecycleInsightResult["series"] => {
  const from = startOfStickinessInterval(start, granularity);
  const to = startOfStickinessInterval(end, granularity);
  const periods: Date[] = [];
  for (let period = from; period <= to; period = nextLifecycleInterval(period, granularity)) {
    periods.push(period);
  }
  const counts = new Map(
    points.map((point) => [`${point.status}:${point.timestamp.getTime()}`, point.count]),
  );
  return statuses.map((status) => ({
    points: periods.map((timestamp) => ({
      count: counts.get(`${status}:${timestamp.getTime()}`) ?? 0,
      timestamp,
    })),
    status,
  }));
};

/** Saved custom insight and dashboard authoring plus executable insight queries. */
export class CustomAnalyticsService extends Context.Service<CustomAnalyticsService>()(
  "CustomAnalyticsService",
  {
    make: Effect.gen(function* () {
      const ch = Option.getOrUndefined(
        yield* Effect.serviceOption(ClickhouseWebClient.ClickhouseWebClient),
      );
      const db = yield* Db;

      /**
       * Run a ClickHouse-backed insight query, or yield no rows at all when the
       * deployment has no analytics storage bound.
       */
      const queryClickhouseRows = <A, E>(
        effect: Effect.Effect<ReadonlyArray<A>, E, ClickhouseWebClient.ClickhouseWebClient>,
      ): Effect.Effect<ReadonlyArray<A>, E> => {
        if (ch === undefined) return Effect.succeed([]);
        return effect.pipe(Effect.provideService(ClickhouseWebClient.ClickhouseWebClient, ch));
      };

      const getProject = Effect.fn("customAnalytics.getProject")(function* (projectId: string) {
        yield* checkProjectPermission(
          projectId,
          "project:all",
          `Not authorized to access analytics for project ${projectId}`,
        );
        const project = yield* db.query.projects.findFirst({
          where: { id: projectId },
        });
        if (!project) {
          return yield* Effect.fail(
            new AnalyticsServiceError({
              cause: projectId,
              message: "Analytics project not found",
            }),
          );
        }
        return project;
      });

      const loadCohortRow = Effect.fn("customAnalytics.loadCohort")(function* (id: string) {
        const [cohort] = yield* db
          .select()
          .from(analyticsCohorts)
          .where(and(eq(analyticsCohorts.id, id), isNull(analyticsCohorts.deletedAt)))
          .limit(1);
        if (!cohort) {
          return yield* Effect.fail(
            new AnalyticsServiceError({ cause: id, message: "Analytics cohort not found" }),
          );
        }
        yield* getProject(cohort.projectId);
        return cohort;
      });

      const hydrateCohort = Effect.fn("customAnalytics.hydrateCohort")(function* (
        cohort: AnalyticsCohortRow,
      ) {
        const members = yield* db
          .select({ personId: analyticsCohortMembers.personId })
          .from(analyticsCohortMembers)
          .where(eq(analyticsCohortMembers.cohortId, cohort.id));
        return {
          createdAt: cohort.createdAt,
          createdBy: cohort.createdBy,
          description: cohort.description,
          id: cohort.id,
          memberCount: members.length,
          memberPersonIds: members.map((member) => member.personId),
          name: cohort.name,
          organizationId: cohort.organizationId,
          projectId: cohort.projectId,
          updatedAt: cohort.updatedAt,
        } satisfies AnalyticsCohortType;
      });

      const validateCohortMembers = Effect.fn("customAnalytics.validateCohortMembers")(function* (
        projectId: string,
        personIds: ReadonlyArray<string>,
      ) {
        const normalized = [...new Set(personIds.map((id) => id.trim()).filter(Boolean))];
        if (normalized.length === 0) return normalized;
        const matching = yield* db
          .select({ id: persons.id })
          .from(persons)
          .where(
            and(
              eq(persons.projectId, projectId),
              inArray(persons.id, normalized),
              isNull(persons.archivedAt),
              isNull(persons.deletedAt),
              isNull(persons.mergedIntoPersonId),
            ),
          );
        if (matching.length !== normalized.length) {
          return yield* Effect.fail(
            new AnalyticsServiceError({
              cause: projectId,
              message: "Every cohort member must be an active person in the cohort project",
            }),
          );
        }
        return normalized;
      });

      const resolveCohortPersonIds = Effect.fn("customAnalytics.resolveCohortPersonIds")(function* (
        projectId: string,
        cohortIds: ReadonlyArray<string> | undefined,
      ) {
        if (cohortIds === undefined) return undefined;
        const uniqueCohortIds = [...new Set(cohortIds)];
        if (uniqueCohortIds.length === 0) {
          return yield* Effect.fail(
            new InvalidAnalyticsQueryError({ message: "Cohort filters cannot be empty" }),
          );
        }
        for (const cohortId of uniqueCohortIds) {
          const cohort = yield* loadCohortRow(cohortId);
          if (cohort.projectId !== projectId) {
            return yield* Effect.fail(
              new AnalyticsServiceError({
                cause: cohortId,
                message: "Analytics cohort belongs to a different project",
              }),
            );
          }
        }
        const members = yield* db
          .select({ personId: analyticsCohortMembers.personId })
          .from(analyticsCohortMembers)
          .where(inArray(analyticsCohortMembers.cohortId, uniqueCohortIds));
        return [...new Set(members.map((member) => member.personId))];
      });

      const loadInsightRow = Effect.fn("customAnalytics.loadInsight")(function* (id: string) {
        const [insight] = yield* db
          .select()
          .from(analyticsInsights)
          .where(and(eq(analyticsInsights.id, id), isNull(analyticsInsights.deletedAt)))
          .limit(1);
        if (!insight) {
          return yield* Effect.fail(
            new AnalyticsServiceError({
              cause: id,
              message: "Analytics insight not found",
            }),
          );
        }
        yield* getProject(insight.projectId);
        return insight;
      });

      const hydrateDashboard = Effect.fn("customAnalytics.hydrateDashboard")(function* (
        dashboard: AnalyticsDashboardRow,
      ) {
        const itemRows = yield* db
          .select()
          .from(analyticsDashboardItems)
          .where(eq(analyticsDashboardItems.dashboardId, dashboard.id))
          .orderBy(asc(analyticsDashboardItems.position));
        const items: Array<AnalyticsDashboardType["items"][number]> = [];
        for (const item of itemRows) {
          if (item.sourceType === "insight") {
            const [insight] = yield* db
              .select()
              .from(analyticsInsights)
              .where(
                and(
                  eq(analyticsInsights.id, item.sourceId),
                  eq(analyticsInsights.projectId, dashboard.projectId),
                  isNull(analyticsInsights.deletedAt),
                ),
              )
              .limit(1);
            if (insight) {
              items.push({
                id: item.id,
                insight: yield* toSavedInsight(insight),
                kind: "insight",
                layout: item.layout,
                position: item.position,
              });
            }
          } else if (item.sourceType === "voidql") {
            const [query] = yield* db
              .select()
              .from(analyticsSavedQuery)
              .where(
                and(
                  eq(analyticsSavedQuery.id, item.sourceId),
                  eq(analyticsSavedQuery.organizationId, dashboard.organizationId),
                ),
              )
              .limit(1);
            if (query) {
              items.push({
                id: item.id,
                kind: "voidql",
                layout: item.layout,
                position: item.position,
                query: toSavedVoidQlInsight(query),
              });
            }
          }
        }
        return {
          createdAt: dashboard.createdAt,
          createdBy: dashboard.createdBy,
          description: dashboard.description,
          id: dashboard.id,
          items,
          name: dashboard.name,
          organizationId: dashboard.organizationId,
          projectId: dashboard.projectId,
          updatedAt: dashboard.updatedAt,
        } satisfies AnalyticsDashboardType;
      });

      const loadDashboardRow = Effect.fn("customAnalytics.loadDashboard")(function* (id: string) {
        const [dashboard] = yield* db
          .select()
          .from(analyticsDashboards)
          .where(and(eq(analyticsDashboards.id, id), isNull(analyticsDashboards.deletedAt)))
          .limit(1);
        if (!dashboard) {
          return yield* Effect.fail(
            new AnalyticsServiceError({
              cause: id,
              message: "Analytics dashboard not found",
            }),
          );
        }
        yield* getProject(dashboard.projectId);
        return dashboard;
      });

      /** Execute a supported custom insight definition. */
      const queryInsight = Effect.fn("customAnalytics.queryInsight")(
        function* (input: {
          readonly definition: CustomAnalyticsInsightQueryType;
          readonly projectId: string;
        }) {
          const project = yield* getProject(input.projectId);
          if (input.definition.actor?.kind === "group") {
            yield* validateCustomEventField(
              `${CUSTOM_PROPERTY_PREFIX}${input.definition.actor.property}`,
            );
          }
          const cohortPersonIds = yield* resolveCohortPersonIds(
            input.projectId,
            input.definition.cohortIds,
          );
          const actorScope: {
            actor?: AnalyticsActorType;
            cohortPersonIds?: ReadonlyArray<string>;
          } = {};
          if (input.definition.actor) actorScope.actor = input.definition.actor;
          if (cohortPersonIds !== undefined) actorScope.cohortPersonIds = cohortPersonIds;
          if (input.definition.kind === "trends") {
            const definition = yield* validateExecutableTrendsDefinition(input.definition);
            const resolvedTimeRange = yield* resolveTimeRange(definition.timeRange);
            const comparisonTimeRange = resolveOptionalTrendsComparisonTimeRange(
              definition.comparison,
              resolvedTimeRange,
            );
            const alignedPoints = (
              points: TrendsInsightResult["series"][number]["points"],
              comparison: "current" | AnalyticsTrendsComparisonType,
            ): TrendsInsightResult["series"][number]["points"] => {
              if (comparisonTimeRange === undefined || comparison === "current") return points;
              return alignTrendsComparisonPoints(
                points,
                resolvedTimeRange,
                comparisonTimeRange,
                definition.granularity,
              );
            };
            const queryPeriod = (
              range: ResolvedTrendsTimeRange,
              comparison: "current" | AnalyticsTrendsComparisonType,
            ) =>
              Effect.all(
                definition.series.map((seriesDefinition) =>
                  Effect.gen(function* () {
                    const groups = yield* queryClickhouseRows(
                      getEventTrendSeries({
                        ...actorScope,
                        aggregation: seriesDefinition.aggregation,
                        aggregateOverRange: definition.display === "number",
                        breakdown: definition.breakdown,
                        eventNames: seriesDefinition.eventNames,
                        filters: { projectIds: [input.projectId] },
                        mathProperty: seriesDefinition.mathProperty,
                        organizationId: project.organizationId,
                        params: {
                          endDate: range.end,
                          granularity: definition.granularity,
                          startDate: range.start,
                        },
                        propertyFilter: seriesDefinition.filters,
                      }),
                    );
                    const baseLabel =
                      seriesDefinition.label ?? seriesDefinition.eventNames.join(" or ");
                    const effectiveGroups = [...groups];
                    if (effectiveGroups.length === 0 && !definition.breakdown) {
                      effectiveGroups.push({ points: [] });
                    }
                    return effectiveGroups.map((group) => ({
                      comparison,
                      key: `${keyWithBreakdown(seriesDefinition.key, group.breakdownValue)}${trendsComparisonKeySuffix(comparison)}`,
                      label: labelWithComparison(
                        labelWithBreakdown(baseLabel, group.breakdownValue),
                        comparison,
                      ),
                      points: alignedPoints(group.points, comparison),
                    }));
                  }),
                ),
                { concurrency: 4 },
              );
            const periodEffects = [queryPeriod(resolvedTimeRange, "current")];
            if (comparisonTimeRange !== undefined && definition.comparison !== undefined) {
              periodEffects.push(queryPeriod(comparisonTimeRange, definition.comparison));
            }
            const periodSeries = yield* Effect.all(periodEffects, { concurrency: 2 });
            const presentPoints = (
              points: TrendsInsightResult["series"][number]["points"],
            ): TrendsInsightResult["series"][number]["points"] => {
              if (definition.display === "number") return points;
              return fillTrendsSeriesPoints(points, resolvedTimeRange, definition.granularity);
            };
            const queriedSeries = periodSeries.flat(2).map((series) => ({
              ...series,
              points: presentPoints(series.points),
            }));
            const resultSeries: TrendsInsightResult["series"] = yield* Effect.gen(function* () {
              if (!definition.formulas?.length) return queriedSeries;
              return yield* buildTrendsFormulaSeries(definition, queriedSeries);
            });
            const presentedSeries = resultSeries.map((series) => ({
              ...series,
              points: applyTrendsPresentation(series.points, definition),
            }));
            const comparisonFields: { comparisonTimeRange?: ResolvedTrendsTimeRange } = {};
            if (comparisonTimeRange !== undefined) {
              comparisonFields.comparisonTimeRange = comparisonTimeRange;
            }
            return {
              ...comparisonFields,
              kind: constant("trends"),
              resolvedTimeRange,
              series: presentedSeries,
            };
          }
          if (input.definition.kind === "funnels") {
            const definition = yield* validateExecutableFunnelsDefinition(input.definition);
            const resolvedTimeRange = yield* resolveTimeRange(definition.timeRange);
            const breakdownFields: {
              breakdown?: ExecutableFunnelsDefinition["breakdown"];
              breakdownAttributionStep?: number;
            } = {};
            if (definition.breakdown) {
              breakdownFields.breakdown = definition.breakdown;
              breakdownFields.breakdownAttributionStep = definition.breakdownAttributionStep ?? 1;
            }
            const funnelInput = {
              ...actorScope,
              ...breakdownFields,
              conversionWindowSeconds: definition.conversionWindowSeconds,
              filters: { projectIds: [input.projectId] },
              order: definition.order,
              organizationId: project.organizationId,
              params: {
                endDate: resolvedTimeRange.end,
                startDate: resolvedTimeRange.start,
              },
              steps: definition.steps,
            };
            const [counts, breakdownCounts] = yield* Effect.all(
              [
                queryClickhouseRows(getEventFunnelCounts(funnelInput)),
                queryClickhouseRows(getEventFunnelBreakdownCounts(funnelInput)),
              ],
              { concurrency: 2 },
            );
            const steps = buildFunnelStepResults(definition, counts);
            const entryCount = steps[0]?.count ?? 0;
            const breakdownResults: {
              breakdowns?: ReadonlyArray<{
                readonly breakdownValue: string;
                readonly steps: FunnelsInsightResult["steps"];
                readonly totalConversionRate: number;
              }>;
            } = {};
            if (definition.breakdown) {
              breakdownResults.breakdowns = breakdownCounts.map((group) => {
                const groupSteps = buildFunnelStepResults(definition, group.counts);
                return {
                  breakdownValue: group.breakdownValue,
                  steps: groupSteps,
                  totalConversionRate: funnelTotalConversionRate(
                    groupSteps,
                    groupSteps[0]?.count ?? 0,
                  ),
                };
              });
            }
            return {
              ...breakdownResults,
              kind: constant("funnels"),
              resolvedTimeRange,
              steps,
              totalConversionRate: funnelTotalConversionRate(steps, entryCount),
            };
          }
          if (input.definition.kind === "retention") {
            const definition = yield* validateExecutableRetentionDefinition(input.definition);
            const resolvedTimeRange = yield* resolveTimeRange(definition.timeRange);
            const cohorts = yield* queryClickhouseRows(
              getEventRetentionCohorts({
                ...actorScope,
                cumulative: definition.cumulative ?? false,
                filters: { projectIds: [input.projectId] },
                intervals: definition.intervals ?? 11,
                organizationId: project.organizationId,
                params: {
                  endDate: resolvedTimeRange.end,
                  startDate: resolvedTimeRange.start,
                },
                period: definition.period,
                retentionType: definition.retentionType ?? "recurring",
                returning: definition.returning,
                start: definition.start,
              }),
            );
            return {
              cohorts: buildRetentionCohortResults(definition, cohorts),
              kind: constant("retention"),
              period: definition.period,
              resolvedTimeRange,
            };
          }
          if (input.definition.kind === "paths") {
            const definition = yield* validateExecutablePathsDefinition(input.definition);
            const resolvedTimeRange = yield* resolveTimeRange(definition.timeRange);
            const sessionGapSeconds = definition.sessionGapSeconds ?? 1_800;
            const links = yield* queryClickhouseRows(
              getEventPathLinks({
                ...actorScope,
                definition,
                filters: { projectIds: [input.projectId] },
                organizationId: project.organizationId,
                params: {
                  endDate: resolvedTimeRange.end,
                  startDate: resolvedTimeRange.start,
                },
              }),
            );
            return {
              kind: constant("paths"),
              links: buildPathsLinkResults(links),
              maxDepth: definition.maxDepth,
              resolvedTimeRange,
              sessionGapSeconds,
            };
          }
          if (input.definition.kind === "stickiness") {
            const definition = yield* validateExecutableStickinessDefinition(input.definition);
            const resolvedTimeRange = yield* resolveTimeRange(definition.timeRange);
            const computation = definition.computation ?? "exact";
            const occurrenceCriteria =
              definition.occurrenceCriteria ?? constant({ operator: "gte", value: 1 });
            const maximumIntervals = countStickinessIntervals(
              resolvedTimeRange.start,
              resolvedTimeRange.end,
              definition.interval,
            );
            if (maximumIntervals > 10_000) {
              return yield* Effect.fail(
                new InvalidAnalyticsQueryError({
                  message: "Stickiness time ranges support at most 10,000 intervals",
                }),
              );
            }
            const series = yield* Effect.all(
              definition.series.map((seriesDefinition) =>
                Effect.gen(function* () {
                  const raw = yield* queryClickhouseRows(
                    getEventStickinessBuckets({
                      ...actorScope,
                      filters: { projectIds: [input.projectId] },
                      interval: definition.interval,
                      occurrenceCriteria,
                      organizationId: project.organizationId,
                      params: {
                        endDate: resolvedTimeRange.end,
                        startDate: resolvedTimeRange.start,
                      },
                      series: seriesDefinition,
                    }),
                  );
                  return {
                    buckets: buildStickinessBuckets(raw, computation, maximumIntervals),
                    key: seriesDefinition.key,
                    label: seriesDefinition.label ?? seriesDefinition.eventNames.join(" or "),
                  };
                }),
              ),
              { concurrency: 4 },
            );
            return {
              computation,
              interval: definition.interval,
              kind: constant("stickiness"),
              resolvedTimeRange,
              series,
            };
          }
          if (input.definition.kind === "lifecycle") {
            const definition = yield* validateExecutableLifecycleDefinition(input.definition);
            const resolvedTimeRange = yield* resolveTimeRange(definition.timeRange);
            const points = yield* queryClickhouseRows(
              getEventLifecyclePoints({
                ...actorScope,
                filters: { projectIds: [input.projectId] },
                granularity: definition.granularity,
                organizationId: project.organizationId,
                params: {
                  endDate: resolvedTimeRange.end,
                  startDate: resolvedTimeRange.start,
                },
                series: definition.series,
              }),
            );
            const statuses =
              definition.statuses ??
              constant(["new", "returning", "resurrecting", "dormant"]);
            return {
              granularity: definition.granularity,
              kind: constant("lifecycle"),
              resolvedTimeRange,
              series: buildLifecycleSeries(
                points,
                statuses,
                resolvedTimeRange.start,
                resolvedTimeRange.end,
                definition.granularity,
              ),
            };
          }
          return yield* Effect.die("Unhandled custom analytics insight kind");
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(
                  new AnalyticsServiceError({
                    cause: String(error.cause),
                    message: "Failed to query the custom analytics insight",
                  }),
                ),
              SqlError: (error) =>
                Effect.fail(
                  new AnalyticsServiceError({
                    cause: error.message,
                    message: "Failed to query the custom analytics insight",
                  }),
                ),
            }),
          ),
      );

      /** List people behind a selected custom-insight event segment. */
      const queryPersons = Effect.fn("customAnalytics.queryPersons")(
        function* (input: {
          readonly cohortIds?: ReadonlyArray<string>;
          readonly eventNames: ReadonlyArray<string>;
          readonly filters?: AnalyticsFilterType;
          readonly group?: { readonly property: string; readonly value: string };
          readonly limit?: number;
          readonly projectId: string;
          readonly timeRange: CustomAnalyticsInsightQueryType["timeRange"];
        }) {
          const project = yield* getProject(input.projectId);
          const eventNames = [
            ...new Set(input.eventNames.map((name) => name.trim()).filter(Boolean)),
          ];
          if (eventNames.length === 0) {
            return yield* Effect.fail(
              new InvalidAnalyticsQueryError({
                message: "Person drilldowns require at least one event name",
              }),
            );
          }
          if (input.filters) yield* validateCustomEventFilter(input.filters);
          if (input.group) {
            yield* validateCustomEventField(`${CUSTOM_PROPERTY_PREFIX}${input.group.property}`);
          }
          const resolvedTimeRange = yield* resolveTimeRange(input.timeRange);
          const cohortPersonIds = yield* resolveCohortPersonIds(input.projectId, input.cohortIds);
          const drilldownScope: {
            cohortPersonIds?: ReadonlyArray<string>;
            filters?: AnalyticsFilterType;
            group?: { readonly property: string; readonly value: string };
          } = {};
          if (cohortPersonIds !== undefined) drilldownScope.cohortPersonIds = cohortPersonIds;
          if (input.filters) drilldownScope.filters = input.filters;
          if (input.group) drilldownScope.group = input.group;
          const rows = yield* queryClickhouseRows(
            getEventPersonDrilldown({
              ...drilldownScope,
              eventNames,
              limit: Math.min(Math.max(input.limit ?? 50, 1), 100),
              organizationId: project.organizationId,
              params: {
                endDate: resolvedTimeRange.end,
                startDate: resolvedTimeRange.start,
              },
              projectId: project.id,
            }),
          );
          if (rows.length === 0) return { people: [], resolvedTimeRange };
          const personRows = yield* db
            .select({ email: persons.email, id: persons.id, name: persons.name })
            .from(persons)
            .where(
              and(
                eq(persons.projectId, project.id),
                inArray(
                  persons.id,
                  rows.map((row) => row.personId),
                ),
                isNull(persons.archivedAt),
                isNull(persons.deletedAt),
                isNull(persons.mergedIntoPersonId),
              ),
            );
          const personById = new Map(personRows.map((person) => [person.id, person]));
          return {
            people: rows.flatMap((row) => {
              const person = personById.get(row.personId);
              if (!person) return [];
              return [
                {
                  email: person.email,
                  eventCount: row.eventCount,
                  lastSeenAt: row.lastSeenAt,
                  name: person.name,
                  personId: row.personId,
                },
              ];
            }),
            resolvedTimeRange,
          };
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(
                  new AnalyticsServiceError({
                    cause: String(error.cause),
                    message: "Failed to query custom analytics people",
                  }),
                ),
              SqlError: (error) =>
                Effect.fail(
                  new AnalyticsServiceError({
                    cause: error.message,
                    message: "Failed to query custom analytics people",
                  }),
                ),
            }),
          ),
      );

      /** List saved insights for a project. */
      const listInsights = Effect.fn("customAnalytics.listInsights")(
        function* (input: { readonly projectId: string }) {
          yield* getProject(input.projectId);
          const rows = yield* db
            .select()
            .from(analyticsInsights)
            .where(
              and(
                eq(analyticsInsights.projectId, input.projectId),
                isNull(analyticsInsights.deletedAt),
              ),
            )
            .orderBy(desc(analyticsInsights.updatedAt));
          return { insights: yield* Effect.forEach(rows, toSavedInsight) };
        },
        (effect) =>
          effect.pipe(
            Effect.catchTag("EffectDrizzleQueryError", (error) =>
              Effect.fail(
                new AnalyticsServiceError({
                  cause: String(error.cause),
                  message: "Failed to list analytics insights",
                }),
              ),
            ),
          ),
      );

      /** Persist a new project insight definition. */
      const createInsight = Effect.fn("customAnalytics.createInsight")(
        function* (input: {
          readonly definition: CustomAnalyticsInsightQueryType;
          readonly description?: string;
          readonly name: string;
          readonly projectId: string;
        }) {
          const project = yield* getProject(input.projectId);
          const session = yield* AuthSession;
          const id = generateId("analyticsInsight");
          yield* db.insert(analyticsInsights).values({
            createdBy: session?.user?.id ?? "system",
            definition: input.definition,
            description: input.description,
            id,
            kind: input.definition.kind,
            name: input.name,
            organizationId: project.organizationId,
            projectId: project.id,
          });
          return yield* toSavedInsight(yield* loadInsightRow(id));
        },
        (effect) =>
          effect.pipe(
            Effect.catchTag("EffectDrizzleQueryError", (error) =>
              Effect.fail(
                new AnalyticsServiceError({
                  cause: String(error.cause),
                  message: "Failed to create analytics insight",
                }),
              ),
            ),
          ),
      );

      /** Update a saved insight's metadata or definition. */
      const updateInsight = Effect.fn("customAnalytics.updateInsight")(
        function* (input: {
          readonly definition?: CustomAnalyticsInsightQueryType;
          readonly description?: string | null;
          readonly id: string;
          readonly name?: string;
        }) {
          yield* loadInsightRow(input.id);
          const changes: {
            definition?: CustomAnalyticsInsightQueryType;
            description?: string | null;
            kind?: CustomAnalyticsInsightQueryType["kind"];
            name?: string;
          } = {};
          if (input.definition !== undefined) {
            changes.definition = input.definition;
            changes.kind = input.definition.kind;
          }
          if (input.description !== undefined) changes.description = input.description;
          if (input.name !== undefined) changes.name = input.name;
          yield* db
            .update(analyticsInsights)
            .set({
              ...changes,
              updatedAt: currentTimestamp(),
            })
            .where(eq(analyticsInsights.id, input.id));
          return yield* toSavedInsight(yield* loadInsightRow(input.id));
        },
        (effect) =>
          effect.pipe(
            Effect.catchTag("EffectDrizzleQueryError", (error) =>
              Effect.fail(
                new AnalyticsServiceError({
                  cause: String(error.cause),
                  message: "Failed to update analytics insight",
                }),
              ),
            ),
          ),
      );

      /** Soft-delete a saved insight and remove it from dashboards. */
      const deleteInsight = Effect.fn("customAnalytics.deleteInsight")(
        function* (input: { readonly id: string }) {
          yield* loadInsightRow(input.id);
          yield* db.transaction((tx) =>
            Effect.gen(function* () {
              yield* tx
                .update(analyticsInsights)
                .set({ deletedAt: currentTimestamp(), updatedAt: currentTimestamp() })
                .where(eq(analyticsInsights.id, input.id));
              yield* tx
                .delete(analyticsDashboardItems)
                .where(
                  and(
                    eq(analyticsDashboardItems.sourceType, "insight"),
                    eq(analyticsDashboardItems.sourceId, input.id),
                  ),
                );
            }),
          );
          return { deleted: true };
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(
                  new AnalyticsServiceError({
                    cause: String(error.cause),
                    message: "Failed to delete analytics insight",
                  }),
                ),
              SqlError: (error) =>
                Effect.fail(
                  new AnalyticsServiceError({
                    cause: error.message,
                    message: "Failed to delete analytics insight",
                  }),
                ),
            }),
          ),
      );

      /** List reusable static cohorts for a project. */
      const listCohorts = Effect.fn("customAnalytics.listCohorts")(
        function* (input: { readonly projectId: string }) {
          yield* getProject(input.projectId);
          const rows = yield* db
            .select()
            .from(analyticsCohorts)
            .where(
              and(
                eq(analyticsCohorts.projectId, input.projectId),
                isNull(analyticsCohorts.deletedAt),
              ),
            )
            .orderBy(desc(analyticsCohorts.updatedAt));
          return { cohorts: yield* Effect.forEach(rows, hydrateCohort) };
        },
        (effect) =>
          effect.pipe(
            Effect.catchTag("EffectDrizzleQueryError", (error) =>
              Effect.fail(
                new AnalyticsServiceError({
                  cause: String(error.cause),
                  message: "Failed to list analytics cohorts",
                }),
              ),
            ),
          ),
      );

      /** Create a reusable static cohort from canonical project people. */
      const createCohort = Effect.fn("customAnalytics.createCohort")(
        function* (input: {
          readonly description?: string;
          readonly memberPersonIds: ReadonlyArray<string>;
          readonly name: string;
          readonly projectId: string;
        }) {
          const project = yield* getProject(input.projectId);
          const session = yield* AuthSession;
          const memberPersonIds = yield* validateCohortMembers(project.id, input.memberPersonIds);
          const id = generateId("analyticsCohort");
          yield* db.transaction((tx) =>
            Effect.gen(function* () {
              yield* tx.insert(analyticsCohorts).values({
                createdBy: session?.user?.id ?? "system",
                description: input.description,
                id,
                name: input.name,
                organizationId: project.organizationId,
                projectId: project.id,
              });
              if (memberPersonIds.length > 0) {
                yield* tx.insert(analyticsCohortMembers).values(
                  memberPersonIds.map((personId) => ({
                    cohortId: id,
                    id: generateId("analyticsCohortMember"),
                    personId,
                  })),
                );
              }
            }),
          );
          return yield* hydrateCohort(yield* loadCohortRow(id));
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(
                  new AnalyticsServiceError({
                    cause: String(error.cause),
                    message: "Failed to create analytics cohort",
                  }),
                ),
              SqlError: (error) =>
                Effect.fail(
                  new AnalyticsServiceError({
                    cause: error.message,
                    message: "Failed to create analytics cohort",
                  }),
                ),
            }),
          ),
      );

      /** Update cohort metadata or atomically replace its static membership. */
      const updateCohort = Effect.fn("customAnalytics.updateCohort")(
        function* (input: {
          readonly description?: string | null;
          readonly id: string;
          readonly memberPersonIds?: ReadonlyArray<string>;
          readonly name?: string;
        }) {
          const cohort = yield* loadCohortRow(input.id);
          const memberPersonIds = yield* Effect.gen(function* () {
            if (input.memberPersonIds === undefined) return undefined;
            return yield* validateCohortMembers(cohort.projectId, input.memberPersonIds);
          });
          const changes: { description?: string | null; name?: string } = {};
          if (input.description !== undefined) changes.description = input.description;
          if (input.name !== undefined) changes.name = input.name;
          yield* db.transaction((tx) =>
            Effect.gen(function* () {
              yield* tx
                .update(analyticsCohorts)
                .set({
                  ...changes,
                  updatedAt: currentTimestamp(),
                })
                .where(eq(analyticsCohorts.id, cohort.id));
              if (memberPersonIds !== undefined) {
                yield* tx
                  .delete(analyticsCohortMembers)
                  .where(eq(analyticsCohortMembers.cohortId, cohort.id));
                if (memberPersonIds.length > 0) {
                  yield* tx.insert(analyticsCohortMembers).values(
                    memberPersonIds.map((personId) => ({
                      cohortId: cohort.id,
                      id: generateId("analyticsCohortMember"),
                      personId,
                    })),
                  );
                }
              }
            }),
          );
          return yield* hydrateCohort(yield* loadCohortRow(cohort.id));
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(
                  new AnalyticsServiceError({
                    cause: String(error.cause),
                    message: "Failed to update analytics cohort",
                  }),
                ),
              SqlError: (error) =>
                Effect.fail(
                  new AnalyticsServiceError({
                    cause: error.message,
                    message: "Failed to update analytics cohort",
                  }),
                ),
            }),
          ),
      );

      /** Soft-delete a cohort and remove its materialized membership. */
      const deleteCohort = Effect.fn("customAnalytics.deleteCohort")(
        function* (input: { readonly id: string }) {
          const cohort = yield* loadCohortRow(input.id);
          yield* db.transaction((tx) =>
            Effect.gen(function* () {
              yield* tx
                .update(analyticsCohorts)
                .set({ deletedAt: currentTimestamp(), updatedAt: currentTimestamp() })
                .where(eq(analyticsCohorts.id, cohort.id));
              yield* tx
                .delete(analyticsCohortMembers)
                .where(eq(analyticsCohortMembers.cohortId, cohort.id));
            }),
          );
          return { deleted: true };
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(
                  new AnalyticsServiceError({
                    cause: String(error.cause),
                    message: "Failed to delete analytics cohort",
                  }),
                ),
              SqlError: (error) =>
                Effect.fail(
                  new AnalyticsServiceError({
                    cause: error.message,
                    message: "Failed to delete analytics cohort",
                  }),
                ),
            }),
          ),
      );

      /** List dashboards and their ordered insight placements. */
      const listDashboards = Effect.fn("customAnalytics.listDashboards")(
        function* (input: { readonly projectId: string }) {
          yield* getProject(input.projectId);
          const rows = yield* db
            .select()
            .from(analyticsDashboards)
            .where(
              and(
                eq(analyticsDashboards.projectId, input.projectId),
                isNull(analyticsDashboards.deletedAt),
              ),
            )
            .orderBy(desc(analyticsDashboards.updatedAt));
          return { dashboards: yield* Effect.forEach(rows, hydrateDashboard) };
        },
        (effect) =>
          effect.pipe(
            Effect.catchTag("EffectDrizzleQueryError", (error) =>
              Effect.fail(
                new AnalyticsServiceError({
                  cause: String(error.cause),
                  message: "Failed to list analytics dashboards",
                }),
              ),
            ),
          ),
      );

      /** Create an empty dashboard for a project. */
      const createDashboard = Effect.fn("customAnalytics.createDashboard")(
        function* (input: {
          readonly description?: string;
          readonly name: string;
          readonly projectId: string;
        }) {
          const project = yield* getProject(input.projectId);
          const session = yield* AuthSession;
          const id = generateId("analyticsDashboard");
          yield* db.insert(analyticsDashboards).values({
            createdBy: session?.user?.id ?? "system",
            description: input.description,
            id,
            name: input.name,
            organizationId: project.organizationId,
            projectId: project.id,
          });
          return yield* hydrateDashboard(yield* loadDashboardRow(id));
        },
        (effect) =>
          effect.pipe(
            Effect.catchTag("EffectDrizzleQueryError", (error) =>
              Effect.fail(
                new AnalyticsServiceError({
                  cause: String(error.cause),
                  message: "Failed to create analytics dashboard",
                }),
              ),
            ),
          ),
      );

      /** Duplicate a dashboard and preserve its ordered card layout. */
      const duplicateDashboard = Effect.fn("customAnalytics.duplicateDashboard")(
        function* (input: { readonly id: string; readonly name?: string }) {
          const source = yield* loadDashboardRow(input.id);
          const sourceItems = yield* db
            .select()
            .from(analyticsDashboardItems)
            .where(eq(analyticsDashboardItems.dashboardId, source.id))
            .orderBy(asc(analyticsDashboardItems.position));
          const session = yield* AuthSession;
          const id = generateId("analyticsDashboard");
          yield* db.transaction((tx) =>
            Effect.gen(function* () {
              yield* tx.insert(analyticsDashboards).values({
                createdBy: session?.user?.id ?? "system",
                description: source.description,
                id,
                name: input.name?.trim() || `${source.name} copy`,
                organizationId: source.organizationId,
                projectId: source.projectId,
              });
              if (sourceItems.length > 0) {
                yield* tx.insert(analyticsDashboardItems).values(
                  sourceItems.map((item) => ({
                    dashboardId: id,
                    id: generateId("analyticsDashboardItem"),
                    layout: item.layout,
                    position: item.position,
                    sourceId: item.sourceId,
                    sourceType: item.sourceType,
                  })),
                );
              }
            }),
          );
          return yield* hydrateDashboard(yield* loadDashboardRow(id));
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(
                  new AnalyticsServiceError({
                    cause: String(error.cause),
                    message: "Failed to duplicate analytics dashboard",
                  }),
                ),
              SqlError: (error) =>
                Effect.fail(
                  new AnalyticsServiceError({
                    cause: error.message,
                    message: "Failed to duplicate analytics dashboard",
                  }),
                ),
            }),
          ),
      );

      /** Update dashboard metadata. */
      const updateDashboard = Effect.fn("customAnalytics.updateDashboard")(
        function* (input: {
          readonly description?: string | null;
          readonly id: string;
          readonly name?: string;
        }) {
          yield* loadDashboardRow(input.id);
          const changes: { description?: string | null; name?: string } = {};
          if (input.description !== undefined) changes.description = input.description;
          if (input.name !== undefined) changes.name = input.name;
          yield* db
            .update(analyticsDashboards)
            .set({
              ...changes,
              updatedAt: currentTimestamp(),
            })
            .where(eq(analyticsDashboards.id, input.id));
          return yield* hydrateDashboard(yield* loadDashboardRow(input.id));
        },
        (effect) =>
          effect.pipe(
            Effect.catchTag("EffectDrizzleQueryError", (error) =>
              Effect.fail(
                new AnalyticsServiceError({
                  cause: String(error.cause),
                  message: "Failed to update analytics dashboard",
                }),
              ),
            ),
          ),
      );

      /** Soft-delete a dashboard and its placements. */
      const deleteDashboard = Effect.fn("customAnalytics.deleteDashboard")(
        function* (input: { readonly id: string }) {
          yield* loadDashboardRow(input.id);
          yield* db.transaction((tx) =>
            Effect.gen(function* () {
              yield* tx
                .update(analyticsDashboards)
                .set({ deletedAt: currentTimestamp(), updatedAt: currentTimestamp() })
                .where(eq(analyticsDashboards.id, input.id));
              yield* tx
                .delete(analyticsDashboardItems)
                .where(eq(analyticsDashboardItems.dashboardId, input.id));
            }),
          );
          return { deleted: true };
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(
                  new AnalyticsServiceError({
                    cause: String(error.cause),
                    message: "Failed to delete analytics dashboard",
                  }),
                ),
              SqlError: (error) =>
                Effect.fail(
                  new AnalyticsServiceError({
                    cause: error.message,
                    message: "Failed to delete analytics dashboard",
                  }),
                ),
            }),
          ),
      );

      /** Add or move a saved insight or VoidQL query on a dashboard. */
      const putDashboardItem = Effect.fn("customAnalytics.putDashboardItem")(
        function* (input: {
          readonly dashboardId: string;
          readonly layout: AnalyticsDashboardItemLayoutType;
          readonly position: number;
          readonly source:
            | { readonly id: string; readonly kind: "insight" }
            | { readonly id: string; readonly kind: "voidql" };
        }) {
          const dashboard = yield* loadDashboardRow(input.dashboardId);
          if (input.source.kind === "insight") {
            const insight = yield* loadInsightRow(input.source.id);
            if (dashboard.projectId !== insight.projectId) {
              return yield* Effect.fail(
                new AnalyticsServiceError({
                  cause: input.source.id,
                  message: "Dashboard and insight must belong to the same project",
                }),
              );
            }
          } else {
            const [query] = yield* db
              .select({ organizationId: analyticsSavedQuery.organizationId })
              .from(analyticsSavedQuery)
              .where(eq(analyticsSavedQuery.id, input.source.id))
              .limit(1);
            if (!query || query.organizationId !== dashboard.organizationId) {
              return yield* Effect.fail(
                new AnalyticsServiceError({
                  cause: input.source.id,
                  message: "Dashboard and saved query must belong to the same organization",
                }),
              );
            }
          }
          const [existing] = yield* db
            .select()
            .from(analyticsDashboardItems)
            .where(
              and(
                eq(analyticsDashboardItems.dashboardId, input.dashboardId),
                eq(analyticsDashboardItems.sourceType, input.source.kind),
                eq(analyticsDashboardItems.sourceId, input.source.id),
              ),
            )
            .limit(1);
          if (existing) {
            yield* db
              .update(analyticsDashboardItems)
              .set({
                layout: input.layout,
                position: input.position,
                updatedAt: currentTimestamp(),
              })
              .where(eq(analyticsDashboardItems.id, existing.id));
          } else {
            yield* db.insert(analyticsDashboardItems).values({
              dashboardId: input.dashboardId,
              id: generateId("analyticsDashboardItem"),
              layout: input.layout,
              position: input.position,
              sourceId: input.source.id,
              sourceType: input.source.kind,
            });
          }
          return yield* hydrateDashboard(dashboard);
        },
        (effect) =>
          effect.pipe(
            Effect.catchTag("EffectDrizzleQueryError", (error) =>
              Effect.fail(
                new AnalyticsServiceError({
                  cause: String(error.cause),
                  message: "Failed to update analytics dashboard item",
                }),
              ),
            ),
          ),
      );

      /** Atomically replace the display order for every card on a dashboard. */
      const reorderDashboardItems = Effect.fn("customAnalytics.reorderDashboardItems")(
        function* (input: {
          readonly dashboardId: string;
          readonly itemIds: ReadonlyArray<string>;
        }) {
          const dashboard = yield* loadDashboardRow(input.dashboardId);
          const itemRows = yield* db
            .select({ id: analyticsDashboardItems.id })
            .from(analyticsDashboardItems)
            .where(eq(analyticsDashboardItems.dashboardId, input.dashboardId));
          const itemIds = [...new Set(input.itemIds)];
          const existingIds = new Set(itemRows.map((item) => item.id));
          if (
            itemIds.length !== input.itemIds.length ||
            itemIds.length !== existingIds.size ||
            itemIds.some((id) => !existingIds.has(id))
          ) {
            return yield* Effect.fail(
              new AnalyticsServiceError({
                cause: input.dashboardId,
                message: "Dashboard card order must include every card exactly once",
              }),
            );
          }
          yield* db.transaction((tx) =>
            Effect.forEach(
              itemIds,
              (id, position) =>
                tx
                  .update(analyticsDashboardItems)
                  .set({ position, updatedAt: currentTimestamp() })
                  .where(
                    and(
                      eq(analyticsDashboardItems.dashboardId, input.dashboardId),
                      eq(analyticsDashboardItems.id, id),
                    ),
                  ),
              { discard: true },
            ),
          );
          return yield* hydrateDashboard(dashboard);
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(
                  new AnalyticsServiceError({
                    cause: String(error.cause),
                    message: "Failed to reorder analytics dashboard cards",
                  }),
                ),
              SqlError: (error) =>
                Effect.fail(
                  new AnalyticsServiceError({
                    cause: error.message,
                    message: "Failed to reorder analytics dashboard cards",
                  }),
                ),
            }),
          ),
      );

      /** Remove a saved analytics card from a dashboard. */
      const removeDashboardItem = Effect.fn("customAnalytics.removeDashboardItem")(
        function* (input: { readonly dashboardId: string; readonly itemId: string }) {
          const dashboard = yield* loadDashboardRow(input.dashboardId);
          yield* db
            .delete(analyticsDashboardItems)
            .where(
              and(
                eq(analyticsDashboardItems.dashboardId, input.dashboardId),
                eq(analyticsDashboardItems.id, input.itemId),
              ),
            );
          return yield* hydrateDashboard(dashboard);
        },
        (effect) =>
          effect.pipe(
            Effect.catchTag("EffectDrizzleQueryError", (error) =>
              Effect.fail(
                new AnalyticsServiceError({
                  cause: String(error.cause),
                  message: "Failed to remove analytics dashboard item",
                }),
              ),
            ),
          ),
      );

      return constant({
        createCohort,
        createDashboard,
        createInsight,
        deleteCohort,
        deleteDashboard,
        deleteInsight,
        duplicateDashboard,
        listCohorts,
        listDashboards,
        listInsights,
        putDashboardItem,
        queryInsight,
        queryPersons,
        reorderDashboardItems,
        removeDashboardItem,
        updateDashboard,
        updateCohort,
        updateInsight,
      });
    }),
  },
) {
  static layer: Layer.Layer<CustomAnalyticsService, never, Db> = Layer.effect(
    CustomAnalyticsService,
  )(CustomAnalyticsService.make);
}
