import * as Str from "effect/String";
import * as Arr from "effect/Array";
import { constant } from "@voidhash/lib/lang";
import type {
  AnalyticsFilterType,
  AnalyticsTrendsComparisonType,
  AnalyticsTrendsFormulaType,
  CustomAnalyticsInsightQueryType,
  QueryCustomAnalyticsInsightResponseType,
} from "@voidhash/rpc";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Option from "effect/Option";
import * as Order from "effect/Order";

import { InvalidAnalyticsQueryError } from "../domain/Analytics.ts";

export interface EventRetentionCohort {
  readonly cohortSize: number;
  readonly cohortStart: Date;
  readonly counts: number[];
}

export interface EventPathLink {
  readonly averageTransitionSeconds: number;
  readonly count: number;
  readonly source: string;
  readonly sourceStep: number;
  readonly target: string;
  readonly targetStep: number;
}

export interface EventStickinessBucket {
  readonly count: number;
  readonly intervals: number;
}

export interface EventLifecyclePoint {
  readonly count: number;
  readonly status: "dormant" | "new" | "resurrecting" | "returning";
  readonly timestamp: Date;
}

const dateFrom = (input: Date | number) => DateTime.toDateUtc(DateTime.makeUnsafe(input));

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

const shiftUtcYear = (value: Date, years: number) => {
  const parts = DateTime.toPartsUtc(DateTime.makeUnsafe(value));
  const targetYear = parts.year + years;
  const targetMonth = DateTime.makeZonedUnsafe(
    { day: 1, month: parts.month, year: targetYear },
    { adjustForTimeZone: true, timeZone: DateTime.zoneMakeNamedUnsafe("UTC") },
  );
  const lastDay = DateTime.toPartsUtc(DateTime.endOf(targetMonth, "month")).day;
  return DateTime.toDateUtc(
    DateTime.setPartsUtc(targetMonth, {
      day: Math.min(parts.day, lastDay),
      hour: parts.hour,
      millisecond: parts.millisecond,
      minute: parts.minute,
      second: parts.second,
    }),
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

/** Key suffix that distinguishes a comparison period's series from the current one. */
const trendsComparisonKeySuffix = (comparison: "current" | AnalyticsTrendsComparisonType) => {
  if (comparison === "current") return "";
  return `:comparison:${comparison}`;
};

/** Human-readable name for a Trends comparison period. */
const trendsComparisonLabel = (comparison: "current" | AnalyticsTrendsComparisonType) => {
  if (comparison === "previous_period") return "previous period";
  if (comparison === "previous_year") return "previous year";
  return undefined;
};

const labelWithComparison = (
  label: string,
  comparison: "current" | AnalyticsTrendsComparisonType,
) => {
  const suffix = trendsComparisonLabel(comparison);
  if (suffix === undefined) return label;
  return `${label} (${suffix})`;
};

const keyWithBreakdown = (key: string, breakdownValue: Option.Option<string>) =>
  Option.match(breakdownValue, { onNone: () => key, onSome: (value) => `${key}:${value}` });

const labelWithBreakdown = (label: string, breakdownValue: Option.Option<string>) =>
  Option.match(breakdownValue, {
    onNone: () => label,
    onSome: (value) => `${label} · ${value || "(empty)"}`,
  });

const stripSuffix = (key: string, suffix: string) => {
  if (Str.isEmpty(suffix)) return key;
  return key.slice(0, -suffix.length);
};

const breakdownValueFromKey = (sourceKey: string, seriesKey: string) => {
  if (sourceKey === seriesKey) return undefined;
  return sourceKey.slice(seriesKey.length + 1);
};

/** Divide while treating an empty denominator as a zero rate. */
const safeRatio = (numerator: number, denominator: number) => {
  if (denominator === 0) return 0;
  return numerator / denominator;
};

const startOfTrendsBucket = (
  value: Date,
  granularity: ExecutableTrendsDefinition["granularity"],
) => {
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

const nextTrendsBucket = (value: Date, granularity: ExecutableTrendsDefinition["granularity"]) => {
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
) => {
  const initial: { readonly buckets: Date[]; readonly cursor: Date } = {
    buckets: [],
    cursor: startOfTrendsBucket(range.start, granularity),
  };
  return Arr.reduce(Arr.range(0, 19_999), initial, (state) => {
    if (state.cursor > range.end) return state;
    state.buckets.push(state.cursor);
    return {
      buckets: state.buckets,
      cursor: nextTrendsBucket(state.cursor, granularity),
    };
  }).buckets;
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
  const currentByComparisonTimestamp = HashMap.fromIterable(
    comparisonBuckets.flatMap((bucket, index) => {
      const currentBucket = currentBuckets[index];
      if (currentBucket === undefined) return [];
      return [[bucket.getTime(), currentBucket] as const];
    }),
  );
  return points.flatMap((point) => {
    return Arr.fromOption(
      Option.map(
        HashMap.get(currentByComparisonTimestamp, point.timestamp.getTime()),
        (timestamp) => ({ ...point, timestamp }),
      ),
    );
  });
};

/** Fill absent Trends buckets with zero so charts and formulas share a complete time axis. */
export const fillTrendsSeriesPoints = (
  points: TrendsInsightResult["series"][number]["points"],
  range: ResolvedTrendsTimeRange,
  granularity: ExecutableTrendsDefinition["granularity"],
): TrendsInsightResult["series"][number]["points"] => {
  const values = HashMap.fromIterable(
    points.map((point) => [point.timestamp.getTime(), point.value] as const),
  );
  return trendsBuckets(range, granularity).map((timestamp) => ({
    timestamp,
    value: Option.getOrElse(HashMap.get(values, timestamp.getTime()), () => 0),
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

const arithmeticOperator = (character: Option.Option<string>) =>
  Option.flatMap(character, (value) =>
    Arr.findFirst(TRENDS_FORMULA_OPERATORS, (operator) => operator === value),
  );

const tokenizeTrendsFormula = (source: string) =>
  Effect.gen(function* () {
    const tokens: TrendsFormulaToken[] = [];
    let offset = 0;
    const scan = (): Effect.Effect<TrendsFormulaToken[], InvalidAnalyticsQueryError> =>
      Effect.gen(function* () {
      if (offset >= source.length) return tokens;
      const character = source[offset];
      if (character && /\s/u.test(character)) {
        offset += 1;
        return yield* scan();
      }
      const remainder = source.slice(offset);
      const number = /^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/iu.exec(remainder)?.[0];
      const identifier = /^[a-z][a-z0-9_]*/iu.exec(remainder)?.[0];
      const operator = Option.getOrUndefined(arithmeticOperator(Option.fromNullishOr(character)));
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
      return yield* scan();
    });
    return yield* scan();
  });

/** Recursive-descent parser over the tokenized Trends formula grammar. */
const parseTrendsFormulaTokens = (
  tokens: ReadonlyArray<TrendsFormulaToken>,
): Effect.Effect<TrendsFormulaNode, InvalidAnalyticsQueryError> => {
  let offset = 0;

  const current = () => tokens[offset];

  const consume = () => {
    const token = current();
    if (!token) {
      return Effect.fail(new InvalidAnalyticsQueryError({ message: "Formula ended unexpectedly" }));
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
      const continueParsing = (
        left: TrendsFormulaNode,
      ): Effect.Effect<TrendsFormulaNode, InvalidAnalyticsQueryError> =>
        Effect.gen(function* () {
        const operator = current();
        if (
          operator?.kind !== "operator" ||
          (operator.value !== "*" && operator.value !== "/" && operator.value !== "%")
        ) {
          return left;
        }
        yield* consume();
        const right = yield* parseUnary();
        return yield* continueParsing({
          kind: "binary",
          left,
          operator: operator.value,
          right,
        });
      });
      return yield* continueParsing(yield* parseUnary());
    });

  const parseAdditive = (): Effect.Effect<TrendsFormulaNode, InvalidAnalyticsQueryError> =>
    Effect.gen(function* () {
      const continueParsing = (
        left: TrendsFormulaNode,
      ): Effect.Effect<TrendsFormulaNode, InvalidAnalyticsQueryError> =>
        Effect.gen(function* () {
        const operator = current();
        if (operator?.kind !== "operator" || (operator.value !== "+" && operator.value !== "-")) {
          return left;
        }
        yield* consume();
        const right = yield* parseMultiplicative();
        return yield* continueParsing({
          kind: "binary",
          left,
          operator: operator.value,
          right,
        });
      });
      return yield* continueParsing(yield* parseMultiplicative());
    });

  return Effect.gen(function* () {
    if (Arr.isReadonlyArrayEmpty(tokens)) {
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

const collectTrendsFormulaReferences = (node: TrendsFormulaNode): HashSet.HashSet<string> => {
  if (node.kind === "series") return HashSet.make(node.key);
  if (node.kind === "unary") return collectTrendsFormulaReferences(node.operand);
  if (node.kind === "binary") {
    return HashSet.union(
      collectTrendsFormulaReferences(node.left),
      collectTrendsFormulaReferences(node.right),
    );
  }
  return HashSet.empty();
};

const applyTrendsFormulaOperator = (
  operator: Extract<TrendsFormulaNode, { readonly kind: "binary" }>["operator"],
  left: number,
  right: number,
) => {
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
  values: HashMap.HashMap<string, number>,
): number => {
  if (node.kind === "number") return node.value;
  if (node.kind === "series") return Option.getOrElse(HashMap.get(values, node.key), () => 0);
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
  allowedSeries: HashSet.HashSet<string>,
) =>
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
    const references = collectTrendsFormulaReferences(node);
    const missing = Arr.fromIterable(references).filter(
      (reference) => !HashSet.has(allowedSeries, reference),
    );
    if (Arr.isReadonlyArrayNonEmpty(missing)) {
      return yield* Effect.fail(
        new InvalidAnalyticsQueryError({
          message: `Trends formula ${formula.key} references unknown series: ${missing.join(", ")}`,
        }),
      );
    }
    return node;
  });

const CUSTOM_PROPERTY_PREFIX = "event.properties.";
const CUSTOM_EVENT_FIELDS = HashSet.make("event.name", "person.id");
const PROPERTY_AGGREGATIONS = HashSet.make(
  "property_sum",
  "property_average",
  "property_minimum",
  "property_maximum",
  "property_median",
  "property_p75",
  "property_p90",
  "property_p95",
  "property_p99",
);

const validateCustomEventField = (field: string) => {
  if (HashSet.has(CUSTOM_EVENT_FIELDS, field)) return Effect.void;
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
      if (Arr.isReadonlyArrayEmpty(filter.filters)) {
        return yield* Effect.fail(
          new InvalidAnalyticsQueryError({
            message: "Custom analytics filter groups cannot be empty",
          }),
        );
      }
      const counts = yield* Effect.all(
        filter.filters.map((child) => validateCustomEventFilter(child, depth + 1)),
        { concurrency: 1 },
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
    const seriesKeys = HashSet.fromIterable(
      definition.series.map((series) => series.key.toLowerCase()),
    );
    if (HashSet.size(seriesKeys) !== definition.series.length) {
      return yield* Effect.fail(
        new InvalidAnalyticsQueryError({ message: "Trends series keys must be unique" }),
      );
    }
    if (definition.formulas) {
      if (Arr.isReadonlyArrayEmpty(definition.formulas) || definition.formulas.length > 8) {
        return yield* Effect.fail(
          new InvalidAnalyticsQueryError({ message: "Trends supports between 1 and 8 formulas" }),
        );
      }
      const formulaKeys = HashSet.fromIterable(
        definition.formulas.map((formula) => formula.key.toLowerCase()),
      );
      if (
        HashSet.size(formulaKeys) !== definition.formulas.length ||
        Arr.fromIterable(formulaKeys).some((key) => HashSet.has(seriesKeys, key))
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
    const predicateCounts = yield* Effect.forEach(
      definition.series,
      Effect.fn("validateTrendsSeries")(function* (series) {
        if (HashSet.has(PROPERTY_AGGREGATIONS, series.aggregation)) {
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
        if (series.filters) return yield* validateCustomEventFilter(series.filters);
        return 0;
      }),
      { concurrency: 1 },
    );
    const predicateCount = Arr.reduce(predicateCounts, 0, (total, count) => total + count);
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
  readonly series: HashMap.HashMap<string, HashMap.HashMap<number, number>>;
}

/** Build formula-only Trends series from the queried source series and their aligned buckets. */
export const buildTrendsFormulaSeries = (
  definition: ExecutableTrendsDefinition,
  sourceSeries: ReadonlyArray<TrendsInsightResult["series"][number]>,
): Effect.Effect<TrendsInsightResult["series"], InvalidAnalyticsQueryError> =>
  Effect.gen(function* () {
    const formulas = definition.formulas;
    if (!formulas?.length) return [...sourceSeries];
    const allowedSeries = HashSet.fromIterable(
      definition.series.map((series) => series.key.toLowerCase()),
    );
    const compiled = yield* Effect.all(
      formulas.map((formula) => compileTrendsFormula(formula, allowedSeries)),
      { concurrency: 4 },
    );
    const definitionsBySpecificity = Arr.sort(
      definition.series,
      Order.mapInput(
        Order.Number,
        (series: ExecutableTrendsDefinition["series"][number]) => -series.key.length,
      ),
    );
    const groups = Arr.reduce(
      sourceSeries,
      HashMap.empty<string, TrendsFormulaGroup>(),
      (all, source) => {
        const comparison = source.comparison ?? "current";
        const sourceKey = stripSuffix(source.key, trendsComparisonKeySuffix(comparison));
        const definitionSeries = definitionsBySpecificity.find(
          (candidate) => sourceKey === candidate.key || sourceKey.startsWith(`${candidate.key}:`),
        );
        if (!definitionSeries) return all;
        const breakdownValue = breakdownValueFromKey(sourceKey, definitionSeries.key);
        const groupKey = `${comparison}\u0000${breakdownValue ?? ""}`;
        const breakdownFields: { breakdownValue?: string } = {};
        if (breakdownValue !== undefined) breakdownFields.breakdownValue = breakdownValue;
        const group = Option.getOrElse(HashMap.get(all, groupKey), () => ({
          ...breakdownFields,
          comparison,
          series: HashMap.empty<string, HashMap.HashMap<number, number>>(),
        }));
        return HashMap.set(all, groupKey, {
          ...group,
          series: HashMap.set(
            group.series,
            definitionSeries.key.toLowerCase(),
            HashMap.fromIterable(
              source.points.map((point) => [point.timestamp.getTime(), point.value]),
            ),
          ),
        });
      },
    );

    return Arr.flatMap(Arr.fromIterable(HashMap.values(groups)), (group) => {
      const timestamps = HashSet.fromIterable(
        Arr.flatMap(Arr.fromIterable(HashMap.values(group.series)), (points) =>
          Arr.fromIterable(HashMap.keys(points)),
        ),
      );
      const sortedTimestamps = Arr.sort(Arr.fromIterable(timestamps), Order.Number);
      return Arr.map(Arr.zip(formulas, compiled), ([formula, node]) => {
          const formulaLabel = formula.label ?? `Formula (${formula.expression})`;
          return {
            comparison: group.comparison,
            key: `${keyWithBreakdown(formula.key, Option.fromNullishOr(group.breakdownValue))}${trendsComparisonKeySuffix(group.comparison)}`,
            label: labelWithComparison(
              labelWithBreakdown(formulaLabel, Option.fromNullishOr(group.breakdownValue)),
              group.comparison,
            ),
            points: sortedTimestamps.map((timestamp) => {
              const values = HashMap.fromIterable(
                Arr.map(
                  Arr.fromIterable(allowedSeries),
                  (seriesKey) =>
                    [
                      seriesKey,
                      Option.flatMap(HashMap.get(group.series, seriesKey), (points) =>
                        HashMap.get(points, timestamp),
                      ).pipe(Option.getOrElse(() => 0)),
                    ] as const,
                ),
              );
              return {
                timestamp: dateFrom(timestamp),
                value: evaluateTrendsFormulaNode(node, values),
              };
            }),
          };
      });
    });
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
    const predicateCounts = yield* Effect.forEach(
      definition.steps,
      (step) => step.filters ? validateCustomEventFilter(step.filters) : Effect.succeed(0),
      { concurrency: 1 },
    );
    const predicateCount = Arr.reduce(predicateCounts, 0, (total, count) => total + count);
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
) => {
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
    if (definition.startEventName !== undefined && Str.isEmpty(definition.startEventName.trim())) {
      return yield* Effect.fail(
        new InvalidAnalyticsQueryError({
          message: "Paths start event cannot be empty",
        }),
      );
    }
    if (definition.endEventName !== undefined && Str.isEmpty(definition.endEventName.trim())) {
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
    const predicateCounts = yield* Effect.forEach(
      definition.series,
      (series) => {
        if (series.aggregation !== "unique_users") {
          return Effect.fail(
            new InvalidAnalyticsQueryError({
              message: "Stickiness series must use unique users",
            }),
          );
        }
        return series.filters ? validateCustomEventFilter(series.filters) : Effect.succeed(0);
      },
      { concurrency: 1 },
    );
    const predicateCount = Arr.reduce(predicateCounts, 0, (total, count) => total + count);
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
) => {
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

const stickinessIntervalMillis = (interval: ExecutableStickinessDefinition["interval"]) => {
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
  counts: HashMap.HashMap<number, number>,
  computation: "cumulative" | "exact",
  intervals: number,
) => {
  if (computation !== "cumulative") {
    return Option.getOrElse(HashMap.get(counts, intervals), () => 0);
  }
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
  const counts = HashMap.fromIterable(raw.map((bucket) => [bucket.intervals, bucket.count]));
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
    if (
      definition.statuses &&
      HashSet.size(HashSet.fromIterable(definition.statuses)) !== definition.statuses.length
    ) {
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
) => {
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
  const buildPeriods = (period: Date): ReadonlyArray<Date> =>
    period > to ? [] : [period, ...buildPeriods(nextLifecycleInterval(period, granularity))];
  const periods = buildPeriods(from);
  const counts = HashMap.fromIterable(
    points.map((point) => [`${point.status}:${point.timestamp.getTime()}`, point.count]),
  );
  return statuses.map((status) => ({
    points: periods.map((timestamp) => ({
      count: Option.getOrElse(HashMap.get(counts, `${status}:${timestamp.getTime()}`), () => 0),
      timestamp,
    })),
    status,
  }));
};
