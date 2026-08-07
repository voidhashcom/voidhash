/**
 * ClickHouse data-access layer for the analytics service: the 12 metric query
 * helpers consumed by `series-resolver`, exposed as {@link analyticsAccessor}.
 * Each returns `ReadonlyArray<AnalyticsDataPoint>` with the period column
 * normalised to `Date`.
 */
import { DateTime, Effect, Option } from "effect";
import { causeMessage, constant, numberOr } from "@voidhash/lib/lang";

import type {
  AnalyticsDataPoint,
  CompiledAnalyticsFilter,
  TimeGranularity,
  TimeRangeParams,
} from "../../domain/analytics/Analytics.ts";
import { ClickhouseWebClient } from "@voidhash/clickhouse-db/clickhouse-client-web";
import type {
  AnalyticsActorType,
  AnalyticsBreakdownType,
  AnalyticsEventSeriesType,
  AnalyticsFilterType,
  FunnelsInsightQueryType,
  LifecycleInsightQueryType,
  PathsInsightQueryType,
  RetentionInsightQueryType,
  StickinessInsightQueryType,
} from "@voidhash/rpc";
import type { SqlError } from "effect/unstable/sql/SqlError";

// Unqualified table names — the runtime Clickhouse client connects with the
// per-stage database (provisioned by `Clickhouse.Database`) as its default,
// so these resolve correctly without a hardcoded database prefix.
const CLICKHOUSE_EVENTS_FULL_TABLE = constant("events_v2");
const CLICKHOUSE_PERSONS_FULL_TABLE = constant("persons_v1");
const CLICKHOUSE_PENDING_OVERRIDES_FULL_TABLE = constant("person_identity_pending_overrides_v2");

const EVENT_ALIAS = "events";
const OVERRIDES_ALIAS = "pending_overrides";
const EVENT_TS = `${EVENT_ALIAS}.event_ts`;
const EVENT_PROPERTIES = `${EVENT_ALIAS}.event_properties`;

// The pending-overrides columns are non-nullable `String` and ClickHouse runs
// with `join_use_nulls = 0`, so an unmatched LEFT JOIN row yields '' (empty
// string), not NULL. A plain `coalesce(overrides.col, events.col)` would stop at
// that '' and collapse every unmatched person into one empty-string key, so each
// override column is `nullIf(col, '')`'d first — turning the no-match '' back
// into NULL — before coalescing to the event's own id.
const effectivePersonIdExpression = `coalesce(nullIf(${OVERRIDES_ALIAS}.person_id, ''), ${EVENT_ALIAS}.person_id)`;
const effectiveDistinctIdExpression = `coalesce(nullIf(${OVERRIDES_ALIAS}.target_distinct_id, ''), ${EVENT_ALIAS}.distinct_id)`;

const PENDING_OVERRIDES_SUBQUERY = `
(
  SELECT
    project_id,
    source_distinct_id,
    target_distinct_id,
    person_id
  FROM (
    SELECT
      project_id,
      source_distinct_id,
      target_distinct_id,
      person_id,
      is_deleted,
      version,
      changed_at
    FROM ${CLICKHOUSE_PENDING_OVERRIDES_FULL_TABLE}
    WHERE version > 0
    ORDER BY
      project_id ASC,
      source_distinct_id ASC,
      version DESC,
      changed_at DESC
    LIMIT 1 BY project_id, source_distinct_id
  )
  WHERE is_deleted = 0
) AS ${OVERRIDES_ALIAS}`;

// Columns the deduped `events` subquery (see `resolvedEventsFrom`) projects for
// the outer query, the pending-overrides JOIN, and the metric expressions.
// `processed_ts` is the latest-wins ORDER BY key — read off the base scan inside
// the subquery, so it does not need to be projected here.
const RESOLVED_EVENTS_COLUMNS = [
  "event_id",
  "event_name",
  "event_ts",
  "project_id",
  "distinct_id",
  "person_id",
  "event_properties",
].join(", ");

const RESOLVED_EVENTS_JOIN = `LEFT JOIN ${PENDING_OVERRIDES_SUBQUERY}
ON ${OVERRIDES_ALIAS}.project_id = ${EVENT_ALIAS}.project_id
AND ${OVERRIDES_ALIAS}.source_distinct_id = ${EVENT_ALIAS}.distinct_id`;

const getDateTruncExpression = (column: string, granularity: TimeGranularity): string => {
  switch (granularity) {
    case "hour":
      return `toStartOfHour(${column})`;
    case "day":
      return `toDate(${column})`;
    case "week":
      return `toStartOfWeek(${column}, 1)`;
    case "month":
      return `toStartOfMonth(${column})`;
    case "quarter":
      return `toStartOfQuarter(${column})`;
    case "year":
      return `toStartOfYear(${column})`;
  }
};

interface AnalyticsRow {
  period: string | Date;
  total: string | number | null;
}

/** Normalises a ClickHouse `DateTime` string to an ISO-8601 UTC instant. */
const withDateTimeSeparator = (trimmed: string): string => {
  if (trimmed.includes("T")) return trimmed;
  return trimmed.replace(" ", "T");
};

const toUtcInstantString = (trimmed: string): string => {
  const normalized = withDateTimeSeparator(trimmed);
  if (/(?:Z|[+-]\d{2}:\d{2})$/.test(normalized)) return normalized;
  return `${normalized}Z`;
};

const parsePeriod = (value: unknown): Date | null => {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;
    return Option.match(DateTime.make(toUtcInstantString(trimmed)), {
      onNone: () => null,
      onSome: (instant) => DateTime.toDateUtc(instant),
    });
  }
  return null;
};

const parseRowsToDataPoints = (rows: ReadonlyArray<AnalyticsRow>): AnalyticsDataPoint[] =>
  rows.flatMap((row) => {
    const timestamp = parsePeriod(row.period);
    if (!timestamp) return [];
    return [{ timestamp, value: numberOr(Number(row.total ?? 0), 0) }];
  });

const jsonString = (...keys: readonly string[]): string =>
  `coalesce(${keys
    .map((key) => `nullIf(JSONExtractString(${EVENT_PROPERTIES}, '${key}'), '')`)
    .join(", ")}, '')`;

const jsonNumber = (...keys: readonly string[]): string =>
  `coalesce(${keys
    .map((key) => `nullIf(JSONExtractFloat(${EVENT_PROPERTIES}, '${key}'), 0)`)
    .join(", ")}, 0)`;

const jsonBool = (...keys: readonly string[]): string =>
  `greatest(${keys.map((key) => `JSONExtractBool(${EVENT_PROPERTIES}, '${key}')`).join(", ")})`;

// USD-only. A row with no FX rate at write time has `amount_usd` NULL; we must
// NOT fall back to the raw original-currency `amount` (e.g. summing £10 as $10),
// so an FX-less row contributes 0 to USD revenue — a bounded under-count rather
// than a silent wrong-currency miscount. Carry-forward FX at write time
// (`FxRateService.getUsdRate`) keeps almost every new row valued, so the
// under-count is negligible.
const amountCentsExpression = jsonNumber("amount_usd", "amountUsd");
const productIdExpression = jsonString("product_id", "productId", "product.id");
const providerEnvironmentExpression = jsonNumber("provider_environment", "providerEnvironment");
const subscriptionStatusExpression = jsonNumber("subscription_status", "subscriptionStatus");
const subscriptionIdExpression = `coalesce(
  nullIf(JSONExtractString(${EVENT_PROPERTIES}, 'subscription_id'), ''),
  nullIf(JSONExtractString(${EVENT_PROPERTIES}, 'subscriptionId'), ''),
  nullIf(JSONExtractString(${EVENT_PROPERTIES}, 'provider_subscription_id'), ''),
  nullIf(JSONExtractString(${EVENT_PROPERTIES}, 'providerSubscriptionId'), ''),
  nullIf(JSONExtractString(${EVENT_PROPERTIES}, 'store_subscription_id'), ''),
  nullIf(JSONExtractString(${EVENT_PROPERTIES}, 'storeSubscriptionId'), ''),
  ${EVENT_ALIAS}.event_id
)`;

/**
 * ClickHouse's `DateTime` named parameter expects `YYYY-MM-DD HH:MM:SS`. The
 * Web client serialises a JS `Date` as ISO with milliseconds otherwise, which
 * the binding parser rejects.
 */
const toClickhouseDateTime = (date: Date): string =>
  date
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d+Z$/, "");

/**
 * Build the optional event-property filter clause as a composed SQL fragment.
 * Each active filter contributes an `AND <expr> IN <typed array param>` term
 * (the expression is raw SQL, the values bound as a typed ClickHouse array
 * parameter); inactive filters contribute nothing. Returns an empty fragment
 * when no filters apply, so it can be interpolated unconditionally into the
 * surrounding query.
 */
const buildEventFilters = (
  ch: ClickhouseWebClient.ClickhouseWebClient,
  filters: CompiledAnalyticsFilter,
) => {
  const terms = [
    { values: filters.productIds, expression: productIdExpression, kind: constant("String") },
    {
      values: filters.providerEnvironments,
      expression: providerEnvironmentExpression,
      kind: constant("Float64"),
    },
    {
      values: filters.subscriptionStatuses,
      expression: subscriptionStatusExpression,
      kind: constant("Float64"),
    },
  ];
  return terms.reduce((acc, term) => {
    if (!term.values || term.values.length === 0) return acc;
    return ch`${acc}
        AND ${ch.literal(term.expression)} IN ${ch.param(`Array(${term.kind})`, term.values)}`;
  }, ch``);
};

/** The composed SQL fragment type produced by the `ch` tagged template. */
type SqlFragment = ReturnType<typeof buildEventFilters>;

/**
 * Lazily selects one of two branches. Stands in for the conditional expressions
 * this module used to build its SQL fragments with (banned by the lint preset)
 * while keeping the unchosen branch unevaluated.
 */
const branch = <A>(condition: boolean, onTrue: () => A, onFalse: () => A): A => {
  if (condition) return onTrue();
  return onFalse();
};

/**
 * Applies `onDefined` to a present optional value, otherwise yields
 * `onAbsent()` — the fragment-building counterpart of `Option.match`.
 */
const whenDefined = <T, A>(
  value: T | undefined,
  onDefined: (value: T) => A,
  onAbsent: () => A,
): A => {
  if (value === undefined) return onAbsent();
  return onDefined(value);
};

/**
 * `FROM (<latest-wins events>) AS events` — collapses the raw `events_v2`
 * MergeTree (which can hold more than one row for a single `event_id` after a
 * retry, replay, or concurrent flush) down to the newest row per `event_id`,
 * ordered by `processed_ts` (the ingestion timestamp). Defense-in-depth so the
 * money sums never double-count a redelivered event; count/`countDistinct`
 * metrics benefit too.
 *
 * The caller's partition-pruning predicate (`project_id` / `event_ts` range /
 * `event_name`) is pushed INTO the inner scan via `innerWhere` so `LIMIT 1 BY`
 * only walks the matching partitions, not the whole table. The RLS
 * `SQL_organization_id` setting is a whole-statement ClickHouse setting, so it
 * still filters every `events_v2` access here — the subquery does not bypass the
 * row policy. Inside the subquery the columns are unqualified (no `events.`
 * alias yet); the outer query then references them through the `events` alias.
 */
const resolvedEventsFrom = (
  ch: ClickhouseWebClient.ClickhouseWebClient,
  innerWhere: ReturnType<typeof buildEventFilters>,
) =>
  ch`FROM (
          SELECT ${ch.literal(RESOLVED_EVENTS_COLUMNS)}
          FROM ${ch.literal(CLICKHOUSE_EVENTS_FULL_TABLE)}
          WHERE ${innerWhere}
          ORDER BY processed_ts DESC
          LIMIT 1 BY event_id
        ) AS ${ch.literal(EVENT_ALIAS)}`;

const moneyPoints = (points: ReadonlyArray<AnalyticsDataPoint>): AnalyticsDataPoint[] =>
  points.map((point) => ({ ...point, value: point.value / 100 }));

interface EventMetricInput {
  readonly aggregateExpression: string;
  readonly eventNames: readonly string[];
  readonly extraWhere?: string;
  readonly filters: CompiledAnalyticsFilter;
  readonly organizationId: string;
  readonly params: TimeRangeParams;
}

/**
 * Per-query setting the readonly ClickHouse user's row policies read. Passing
 * it scopes every analytics read to the caller's tenant; omitting it would
 * match no rows (fail-closed).
 */
const tenantSettings = (organizationId: string): Record<string, string> => ({
  SQL_organization_id: organizationId,
});

const eventMetric = (input: EventMetricInput) =>
  Effect.gen(function* () {
    const ch = yield* ClickhouseWebClient.ClickhouseWebClient;
    const period = getDateTruncExpression(EVENT_TS, input.params.granularity);
    const eventFilters = buildEventFilters(ch, input.filters);
    // The project/time/event-name predicate is the partition-pruning filter, so
    // it lives inside the dedup subquery (before `LIMIT 1 BY`). The optional
    // event-property filters (`eventFilters`) and `extraWhere` stay in the outer
    // WHERE: they read `event_properties`, and applying them to the already-
    // deduped row is correct (a true duplicate carries identical properties) and
    // cheaper than running JSONExtract on the pre-dedup rows.
    const dedupedEvents = resolvedEventsFrom(
      ch,
      ch`project_id IN ${ch.param("Array(String)", input.filters.projectIds)}
          AND event_ts >= ${ch.param("DateTime", toClickhouseDateTime(input.params.startDate))}
          AND event_ts <= ${ch.param("DateTime", toClickhouseDateTime(input.params.endDate))}
          AND event_name IN ${ch.param("Array(String)", input.eventNames)}`,
    );

    const rows = yield* ch.withClickhouseSettings(
      ch<AnalyticsRow>`
        SELECT
          ${ch.literal(period)} AS period,
          ${ch.literal(input.aggregateExpression)} AS total
        ${dedupedEvents}
        ${ch.literal(RESOLVED_EVENTS_JOIN)}
        WHERE 1 = 1
          ${eventFilters}
          ${ch.literal(input.extraWhere ?? "")}
        GROUP BY period
        ORDER BY period ASC
      `,
      tenantSettings(input.organizationId),
    );

    return parseRowsToDataPoints(rows);
  });

export interface EventTrendQueryInput extends AnalyticsActorQueryInput {
  readonly aggregation: AnalyticsEventSeriesType["aggregation"];
  readonly aggregateOverRange?: boolean;
  readonly breakdown?: AnalyticsBreakdownType;
  readonly eventNames: readonly string[];
  readonly filters: CompiledAnalyticsFilter;
  readonly mathProperty?: string;
  readonly propertyFilter?: AnalyticsFilterType;
  readonly organizationId: string;
  readonly params: TimeRangeParams;
}

export interface EventTrendSeriesGroup {
  readonly breakdownValue?: string;
  readonly points: AnalyticsDataPoint[];
}

interface AnalyticsActorQueryInput {
  readonly actor?: AnalyticsActorType;
  readonly cohortPersonIds?: readonly string[];
}

interface EventTrendRow extends AnalyticsRow {
  breakdown: string;
}

const customEventField = (
  ch: ClickhouseWebClient.ClickhouseWebClient,
  field: string,
): ReturnType<typeof buildEventFilters> => {
  if (field === "event.name") return ch`${ch.literal(`${EVENT_ALIAS}.event_name`)}`;
  if (field === "person.id") {
    return ch`${ch.literal(
      `coalesce(${effectivePersonIdExpression}, ${effectiveDistinctIdExpression})`,
    )}`;
  }
  return ch`JSONExtractString(
    ${ch.literal(EVENT_PROPERTIES)},
    ${ch.param("String", field.slice("event.properties.".length))}
  )`;
};

const analyticsActorKey = (
  ch: ClickhouseWebClient.ClickhouseWebClient,
  actor: AnalyticsActorType | undefined,
): SqlFragment => {
  if (actor?.kind === "group") {
    return ch`nullIf(JSONExtractString(
        ${ch.literal(EVENT_PROPERTIES)},
        ${ch.param("String", actor.property)}
      ), '')`;
  }
  return ch`${ch.literal(
    `coalesce(${effectivePersonIdExpression}, ${effectiveDistinctIdExpression})`,
  )}`;
};

const analyticsCohortFilter = (
  ch: ClickhouseWebClient.ClickhouseWebClient,
  cohortPersonIds: readonly string[] | undefined,
): SqlFragment => {
  if (cohortPersonIds === undefined) return ch`1 = 1`;
  if (cohortPersonIds.length === 0) return ch`0 = 1`;
  return ch`${ch.literal(effectivePersonIdExpression)} IN ${ch.param(
    "Array(String)",
    cohortPersonIds,
  )}`;
};

const analyticsActorFilter = (
  ch: ClickhouseWebClient.ClickhouseWebClient,
  input: AnalyticsActorQueryInput,
): SqlFragment => {
  const actorKey = analyticsActorKey(ch, input.actor);
  const cohortFilter = analyticsCohortFilter(ch, input.cohortPersonIds);
  return ch`notEmpty(toString(${actorKey})) AND ${cohortFilter}`;
};

const stringFilterValue = (value: unknown): string => causeMessage(value ?? "");

const OPERATOR_BY_FILTER_TYPE = constant({ and: "AND", or: "OR" });

/**
 * Narrows a filter node to its leaf predicate. The `and` / `or` member of
 * {@link AnalyticsFilterType} carries a two-literal `type`, which control-flow
 * analysis cannot discriminate away on its own.
 */
const isFilterPredicate = (
  filter: AnalyticsFilterType,
): filter is Extract<AnalyticsFilterType, { readonly type: "predicate" }> =>
  filter.type === "predicate";

/** Coerces a predicate's value to the string array an `IN` / `NOT IN` term binds. */
const stringFilterValues = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(stringFilterValue);
  return [];
};

const buildCustomEventFilter = (
  ch: ClickhouseWebClient.ClickhouseWebClient,
  filter: AnalyticsFilterType,
): ReturnType<typeof buildEventFilters> => {
  if (filter.type === "and" || filter.type === "or") {
    const operator = OPERATOR_BY_FILTER_TYPE[filter.type];
    return filter.filters
      .reduce((acc, child, index) => {
        if (index === 0) return ch`(${buildCustomEventFilter(ch, child)}`;
        return ch`${acc} ${ch.literal(operator)} ${buildCustomEventFilter(ch, child)}`;
      }, ch``)
      .pipe((fragment) => ch`${fragment})`);
  }
  if (filter.type === "not") {
    return ch`NOT (${buildCustomEventFilter(ch, filter.filter)})`;
  }

  if (!isFilterPredicate(filter)) return ch`0 = 1`;

  const predicate = filter;
  const expression = customEventField(ch, predicate.field);
  switch (predicate.op) {
    case "eq":
      return ch`${expression} = ${ch.param("String", stringFilterValue(predicate.value))}`;
    case "neq":
      return ch`${expression} != ${ch.param("String", stringFilterValue(predicate.value))}`;
    case "in":
      return ch`${expression} IN ${ch.param("Array(String)", stringFilterValues(predicate.value))}`;
    case "not_in":
      return ch`${expression} NOT IN ${ch.param(
        "Array(String)",
        stringFilterValues(predicate.value),
      )}`;
    case "contains":
      return ch`positionCaseInsensitive(
        ${expression},
        ${ch.param("String", stringFilterValue(predicate.value))}
      ) > 0`;
    case "exists":
      return ch`notEmpty(${expression})`;
    case "gt":
    case "gte":
    case "lt":
    case "lte":
      return ch`0 = 1`;
  }
  return ch`0 = 1`;
};

/** Renders a breakdown's sort order as the SQL keyword. */
const sortDirection = (order: AnalyticsBreakdownType["order"]): string => {
  if (order === "asc") return "ASC";
  return "DESC";
};

/** Only breakdown queries carry a `breakdownValue` on their series groups. */
const breakdownValueEntry = (
  breakdown: AnalyticsBreakdownType | undefined,
  breakdownValue: string,
) => {
  if (breakdown === undefined) return {};
  return { breakdownValue };
};

/** Maps a trend series' aggregation to its ClickHouse aggregate expression. */
const eventTrendAggregate = (
  ch: ClickhouseWebClient.ClickhouseWebClient,
  aggregation: EventTrendQueryInput["aggregation"],
  actorKey: SqlFragment,
  propertyExpression: SqlFragment,
): SqlFragment => {
  switch (aggregation) {
    case "unique_users":
      return ch`countDistinct(${actorKey})`;
    case "property_sum":
      return ch`sum(${propertyExpression})`;
    case "property_average":
      return ch`avg(${propertyExpression})`;
    case "property_minimum":
      return ch`min(${propertyExpression})`;
    case "property_maximum":
      return ch`max(${propertyExpression})`;
    case "property_median":
      return ch`quantileExact(0.5)(${propertyExpression})`;
    case "property_p75":
      return ch`quantileExact(0.75)(${propertyExpression})`;
    case "property_p90":
      return ch`quantileExact(0.9)(${propertyExpression})`;
    case "property_p95":
      return ch`quantileExact(0.95)(${propertyExpression})`;
    case "property_p99":
      return ch`quantileExact(0.99)(${propertyExpression})`;
    default:
      return ch`count()`;
  }
};

/**
 * Query a custom event series using the identity-stitched analytics event view.
 * Number displays can aggregate the whole range into one point without summing per-bucket users.
 */
export const getEventTrendSeries = (input: EventTrendQueryInput) =>
  Effect.gen(function* () {
    const ch = yield* ClickhouseWebClient.ClickhouseWebClient;
    const actorKey = analyticsActorKey(ch, input.actor);
    const actorFilter = analyticsActorFilter(ch, input);
    const period = branch(
      input.aggregateOverRange === true,
      () => "toDateTime('1970-01-01 00:00:00')",
      () => getDateTruncExpression(EVENT_TS, input.params.granularity),
    );
    const propertyExpression = ch`toFloat64OrNull(JSONExtractRaw(
      ${ch.literal(EVENT_PROPERTIES)},
      ${ch.param("String", input.mathProperty ?? "")}
    ))`;
    const aggregateExpression = eventTrendAggregate(
      ch,
      input.aggregation,
      actorKey,
      propertyExpression,
    );
    const breakdownExpression = whenDefined(
      input.breakdown,
      (breakdown) => customEventField(ch, breakdown.field),
      () => ch`${ch.param("String", "")}`,
    );
    const customFilter = whenDefined(
      input.propertyFilter,
      (filter) => buildCustomEventFilter(ch, filter),
      () => ch`1 = 1`,
    );
    const perPeriodLimit = whenDefined(
      input.breakdown,
      (breakdown) => Math.min((breakdown.limit ?? 10) * 4, 400),
      () => 1,
    );
    const dedupedEvents = resolvedEventsFrom(
      ch,
      ch`project_id IN ${ch.param("Array(String)", input.filters.projectIds)}
          AND event_ts >= ${ch.param("DateTime", toClickhouseDateTime(input.params.startDate))}
          AND event_ts <= ${ch.param("DateTime", toClickhouseDateTime(input.params.endDate))}
          AND event_name IN ${ch.param("Array(String)", input.eventNames)}`,
    );
    const rows = yield* ch.withClickhouseSettings(
      ch<EventTrendRow>`
        SELECT
          ${ch.literal(period)} AS period,
          ${breakdownExpression} AS breakdown,
          ${aggregateExpression} AS total
        ${dedupedEvents}
        ${ch.literal(RESOLVED_EVENTS_JOIN)}
        WHERE ${customFilter}
          AND ${actorFilter}
        GROUP BY period, breakdown
        ORDER BY period ASC, total DESC
        LIMIT ${ch.param("UInt32", perPeriodLimit)} BY period
      `,
      tenantSettings(input.organizationId),
    );

    const grouped = new Map<string, AnalyticsDataPoint[]>();
    for (const row of rows) {
      const points = parseRowsToDataPoints([row]);
      if (points.length === 0) continue;
      const key = whenDefined(
        input.breakdown,
        () => row.breakdown,
        () => "",
      );
      const existing = grouped.get(key);
      if (existing) existing.push(points[0]);
      else grouped.set(key, points);
    }

    const breakdown = input.breakdown;
    const groups = [...grouped.entries()].map(([breakdownValue, points]) => ({
      ...breakdownValueEntry(breakdown, breakdownValue),
      points,
    }));
    if (!breakdown) return groups;

    const direction = branch(
      breakdown.order === "asc",
      () => 1,
      () => -1,
    );
    return groups
      .sort(
        (left, right) =>
          direction *
          (left.points.reduce((sum, point) => sum + point.value, 0) -
            right.points.reduce((sum, point) => sum + point.value, 0)),
      )
      .slice(0, breakdown.limit ?? 10);
  });

export interface EventPersonDrilldownQueryInput {
  readonly cohortPersonIds?: readonly string[];
  readonly eventNames: readonly string[];
  readonly filters?: AnalyticsFilterType;
  readonly group?: { readonly property: string; readonly value: string };
  readonly limit: number;
  readonly organizationId: string;
  readonly params: Pick<TimeRangeParams, "endDate" | "startDate">;
  readonly projectId: string;
}

export interface EventPersonDrilldownRow {
  readonly eventCount: number;
  readonly lastSeenAt: Date;
  readonly personId: string;
}

interface EventPersonDrilldownSqlRow {
  event_count: number | string;
  last_seen_at: Date | string;
  person_id: string;
}

/** Query people who performed a selected event series in a bounded insight window. */
export const getEventPersonDrilldown = (input: EventPersonDrilldownQueryInput) =>
  Effect.gen(function* () {
    const ch = yield* ClickhouseWebClient.ClickhouseWebClient;
    const propertyFilter = whenDefined(
      input.filters,
      (filters) => buildCustomEventFilter(ch, filters),
      () => ch`1 = 1`,
    );
    const cohortFilter = analyticsActorFilter(ch, {
      actor: { kind: "person" },
      cohortPersonIds: input.cohortPersonIds,
    });
    const groupFilter = whenDefined(
      input.group,
      (group) =>
        ch`${customEventField(ch, `event.properties.${group.property}`)} = ${ch.param(
          "String",
          group.value,
        )}`,
      () => ch`1 = 1`,
    );
    const dedupedEvents = resolvedEventsFrom(
      ch,
      ch`project_id = ${ch.param("String", input.projectId)}
          AND event_ts >= ${ch.param("DateTime", toClickhouseDateTime(input.params.startDate))}
          AND event_ts <= ${ch.param("DateTime", toClickhouseDateTime(input.params.endDate))}
          AND event_name IN ${ch.param("Array(String)", input.eventNames)}`,
    );
    const rows = yield* ch.withClickhouseSettings(
      ch<EventPersonDrilldownSqlRow>`
        SELECT
          ${ch.literal(effectivePersonIdExpression)} AS person_id,
          count() AS event_count,
          max(${ch.literal(EVENT_TS)}) AS last_seen_at
        ${dedupedEvents}
        ${ch.literal(RESOLVED_EVENTS_JOIN)}
        WHERE notEmpty(person_id)
          AND ${propertyFilter}
          AND ${cohortFilter}
          AND ${groupFilter}
        GROUP BY person_id
        ORDER BY last_seen_at DESC, event_count DESC, person_id ASC
        LIMIT ${ch.param("UInt8", input.limit)}
      `,
      tenantSettings(input.organizationId),
    );

    return rows.flatMap((row) => {
      const lastSeenAt = parsePeriod(row.last_seen_at);
      if (!lastSeenAt) return [];
      return [{ eventCount: Number(row.event_count ?? 0), lastSeenAt, personId: row.person_id }];
    });
  });

export interface EventFunnelQueryInput extends AnalyticsActorQueryInput {
  readonly breakdown?: AnalyticsBreakdownType;
  readonly breakdownAttributionStep?: number;
  readonly conversionWindowSeconds: number;
  readonly filters: CompiledAnalyticsFilter;
  readonly order: FunnelsInsightQueryType["order"];
  readonly organizationId: string;
  readonly params: Pick<TimeRangeParams, "endDate" | "startDate">;
  readonly steps: FunnelsInsightQueryType["steps"];
}

const joinSqlFragments = (
  ch: ClickhouseWebClient.ClickhouseWebClient,
  fragments: ReadonlyArray<ReturnType<typeof buildEventFilters>>,
  separator = ", ",
): ReturnType<typeof buildEventFilters> =>
  fragments.reduce((acc, fragment, index) => {
    if (index === 0) return fragment;
    return ch`${acc}${ch.literal(separator)}${fragment}`;
  }, ch``);

interface EventFunnelBreakdownCounts {
  readonly breakdownValue: string;
  readonly counts: number[];
}

const queryEventFunnelRows = (
  input: EventFunnelQueryInput,
  withBreakdown: boolean,
): Effect.Effect<
  ReadonlyArray<Record<string, string | number>>,
  SqlError,
  ClickhouseWebClient.ClickhouseWebClient
> =>
  Effect.gen(function* () {
    const ch = yield* ClickhouseWebClient.ClickhouseWebClient;
    const breakdown = branch(
      withBreakdown,
      () => input.breakdown,
      () => undefined,
    );
    const conversionWindowMilliseconds = input.conversionWindowSeconds * 1_000;
    const allEventNames = [...new Set(input.steps.flatMap((step) => [...step.eventNames]))];
    const eventNameScope = branch(
      input.order === "strict",
      () => ch``,
      () => ch`AND event_name IN ${ch.param("Array(String)", allEventNames)}`,
    );
    const dedupedEvents = resolvedEventsFrom(
      ch,
      ch`project_id IN ${ch.param("Array(String)", input.filters.projectIds)}
          AND event_ts >= ${ch.param("DateTime", toClickhouseDateTime(input.params.startDate))}
          AND event_ts <= ${ch.param("DateTime", toClickhouseDateTime(input.params.endDate))}
          ${eventNameScope}`,
    );
    const actorKey = analyticsActorKey(ch, input.actor);
    const actorFilter = analyticsActorFilter(ch, input);
    const stepConditions = input.steps.map((step) => {
      const propertyFilter = whenDefined(
        step.filters,
        (filters) => buildCustomEventFilter(ch, filters),
        () => ch`1 = 1`,
      );
      return ch`(
        ${ch.literal(`${EVENT_ALIAS}.event_name`)} IN ${ch.param("Array(String)", step.eventNames)}
        AND ${propertyFilter}
      )`;
    });
    const attributionIndex = Math.min(
      Math.max((input.breakdownAttributionStep ?? 1) - 1, 0),
      input.steps.length - 1,
    );
    const attributionCondition = stepConditions[attributionIndex] ?? ch`0 = 1`;
    const breakdownAggregate = whenDefined<AnalyticsBreakdownType, SqlFragment | undefined>(
      breakdown,
      (value) =>
        ch`argMinIf(
          toString(${customEventField(ch, value.field)}),
          ${ch.literal(EVENT_TS)},
          ${attributionCondition}
        )`,
      () => undefined,
    );
    const breakdownProjection = whenDefined(
      breakdownAggregate,
      (aggregate) => ch`, ${aggregate} AS breakdown_value`,
      () => ch``,
    );
    const breakdownSelect = whenDefined(
      breakdown,
      () => ch`breakdown_value,`,
      () => ch``,
    );
    const breakdownGrouping = whenDefined(
      breakdown,
      (value) =>
        ch`GROUP BY breakdown_value
          ORDER BY ${ch.literal(`step_${input.steps.length - 1}`)}
            ${ch.literal(sortDirection(value.order))},
            breakdown_value ASC
          LIMIT ${ch.param("UInt32", value.limit ?? 10)}`,
      () => ch``,
    );

    if (input.order === "any") {
      const timeArrays = stepConditions.map(
        (condition, index) =>
          ch`groupArrayIf(
            toUInt64(toUnixTimestamp64Milli(${ch.literal(EVENT_TS)})),
            ${condition}
          ) AS ${ch.literal(`times_${index}`)}`,
      );
      const counts = input.steps.map((_, stepIndex) => {
        const aliases = Array.from({ length: stepIndex + 1 }, (_, index) => `times_${index}`);
        if (stepIndex === 0) {
          return ch`countIf(notEmpty(${ch.literal(aliases[0] ?? "times_0")})) AS ${ch.literal(
            "step_0",
          )}`;
        }
        const candidates = joinSqlFragments(
          ch,
          aliases.map((alias) => ch`${ch.literal(alias)}`),
        );
        const windowChecks = joinSqlFragments(
          ch,
          aliases.map(
            (alias) =>
              ch`arrayExists(
                candidate -> candidate >= window_start
                  AND candidate <= window_start + ${ch.param("UInt64", conversionWindowMilliseconds)},
                ${ch.literal(alias)}
              )`,
          ),
          " AND ",
        );
        return ch`countIf(
          arrayExists(
            window_start -> (${windowChecks}),
            arrayConcat(${candidates})
          )
        ) AS ${ch.literal(`step_${stepIndex}`)}`;
      });
      return yield* ch.withClickhouseSettings(
        ch<Record<string, string | number>>`
          SELECT ${breakdownSelect} ${joinSqlFragments(ch, counts)}
          FROM (
            SELECT
              ${actorKey} AS person_key,
              ${joinSqlFragments(ch, timeArrays)}
              ${breakdownProjection}
            ${dedupedEvents}
            ${ch.literal(RESOLVED_EVENTS_JOIN)}
            WHERE ${actorFilter}
            GROUP BY person_key
          )
          ${breakdownGrouping}
        `,
        tenantSettings(input.organizationId),
      );
    }

    const modes = branch(
      input.order === "strict",
      () =>
        ch`${ch.param("UInt64", conversionWindowMilliseconds)}, 'strict_deduplication', 'strict_order'`,
      () => ch`${ch.param("UInt64", conversionWindowMilliseconds)}, 'strict_deduplication'`,
    );
    const funnelLevel = ch`windowFunnel(${modes})(
      toUInt64(toUnixTimestamp64Milli(${ch.literal(EVENT_TS)})),
      ${joinSqlFragments(ch, stepConditions)}
    )`;
    const counts = input.steps.map(
      (_, index) =>
        ch`countIf(level >= ${ch.param("UInt8", index + 1)}) AS ${ch.literal(`step_${index}`)}`,
    );
    return yield* ch.withClickhouseSettings(
      ch<Record<string, string | number>>`
        SELECT ${breakdownSelect} ${joinSqlFragments(ch, counts)}
        FROM (
          SELECT
            ${actorKey} AS person_key,
            ${funnelLevel} AS level
            ${breakdownProjection}
          ${dedupedEvents}
          ${ch.literal(RESOLVED_EVENTS_JOIN)}
          WHERE ${actorFilter}
          GROUP BY person_key
        )
        ${breakdownGrouping}
      `,
      tenantSettings(input.organizationId),
    );
  });

const funnelCountsFromRow = (
  row: Record<string, string | number> | undefined,
  stepCount: number,
): number[] => Array.from({ length: stepCount }, (_, index) => Number(row?.[`step_${index}`] ?? 0));

/** Query overall step reach counts for an identity-stitched event funnel. */
export const getEventFunnelCounts = (input: EventFunnelQueryInput) =>
  queryEventFunnelRows(input, false).pipe(
    Effect.map((rows) => funnelCountsFromRow(rows[0], input.steps.length)),
  );

/** Query attributed step reach counts for the top funnel breakdown values. */
export const getEventFunnelBreakdownCounts = (
  input: EventFunnelQueryInput,
): Effect.Effect<
  ReadonlyArray<EventFunnelBreakdownCounts>,
  SqlError,
  ClickhouseWebClient.ClickhouseWebClient
> => {
  if (!input.breakdown) return Effect.succeed([]);
  return queryEventFunnelRows(input, true).pipe(
    Effect.map((rows) =>
      rows.map((row) => ({
        breakdownValue: String(row.breakdown_value ?? ""),
        counts: funnelCountsFromRow(row, input.steps.length),
      })),
    ),
  );
};

export interface EventRetentionQueryInput extends AnalyticsActorQueryInput {
  readonly cumulative: boolean;
  readonly filters: CompiledAnalyticsFilter;
  readonly intervals: number;
  readonly organizationId: string;
  readonly params: Pick<TimeRangeParams, "endDate" | "startDate">;
  readonly period: RetentionInsightQueryType["period"];
  readonly retentionType: "first_time" | "recurring";
  readonly returning: RetentionInsightQueryType["returning"];
  readonly start: RetentionInsightQueryType["start"];
}

export interface EventRetentionCohort {
  readonly cohortSize: number;
  readonly cohortStart: Date;
  readonly counts: number[];
}

interface EventRetentionRow extends Record<string, string | number | Date> {
  cohort_size: string | number;
  cohort_start: string | Date;
}

/** Query recurring or first-time identity-stitched retention cohorts. */
export const getEventRetentionCohorts = (input: EventRetentionQueryInput) =>
  Effect.gen(function* () {
    const ch = yield* ClickhouseWebClient.ClickhouseWebClient;
    const periodExpression = getDateTruncExpression(EVENT_TS, input.period);
    const actorKey = analyticsActorKey(ch, input.actor);
    const actorFilter = analyticsActorFilter(ch, input);
    const startFilter = whenDefined(
      input.start.filters,
      (filters) => buildCustomEventFilter(ch, filters),
      () => ch`1 = 1`,
    );
    const returningFilter = whenDefined(
      input.returning.filters,
      (filters) => buildCustomEventFilter(ch, filters),
      () => ch`1 = 1`,
    );
    const startFrom = resolvedEventsFrom(
      ch,
      ch`project_id IN ${ch.param("Array(String)", input.filters.projectIds)}
          ${branch(
            input.retentionType === "recurring",
            () =>
              ch`AND event_ts >= ${ch.param(
                "DateTime",
                toClickhouseDateTime(input.params.startDate),
              )}`,
            () => ch``,
          )}
          AND event_ts <= ${ch.param("DateTime", toClickhouseDateTime(input.params.endDate))}
          AND event_name IN ${ch.param("Array(String)", [...input.start.eventNames])}`,
    );
    const returningFrom = resolvedEventsFrom(
      ch,
      ch`project_id IN ${ch.param("Array(String)", input.filters.projectIds)}
          AND event_ts >= ${ch.param("DateTime", toClickhouseDateTime(input.params.startDate))}
          AND event_ts <= ${ch.param("DateTime", toClickhouseDateTime(input.params.endDate))}
          AND event_name IN ${ch.param("Array(String)", [...input.returning.eventNames])}`,
    );
    const starts = branch(
      input.retentionType === "recurring",
      () => ch`
            SELECT
              ${actorKey} AS person_key,
              ${ch.literal(periodExpression)} AS cohort_start
            ${startFrom}
            ${ch.literal(RESOLVED_EVENTS_JOIN)}
            WHERE ${startFilter} AND ${actorFilter}
            GROUP BY person_key, cohort_start
          `,
      () => ch`
            SELECT
              ${actorKey} AS person_key,
              min(${ch.literal(periodExpression)}) AS cohort_start
            ${startFrom}
            ${ch.literal(RESOLVED_EVENTS_JOIN)}
            WHERE ${startFilter} AND ${actorFilter}
            GROUP BY person_key
            HAVING cohort_start >= ${ch.param(
              "DateTime",
              toClickhouseDateTime(input.params.startDate),
            )}
          `,
    );
    const returns = ch`
      SELECT
        ${actorKey} AS person_key,
        ${ch.literal(periodExpression)} AS return_period
      ${returningFrom}
      ${ch.literal(RESOLVED_EVENTS_JOIN)}
      WHERE ${returningFilter} AND ${actorFilter}
      GROUP BY person_key, return_period
    `;
    const intervalCounts = Array.from({ length: input.intervals }, (_, interval) => {
      const intervalCondition = branch(
        input.cumulative && interval > 0,
        () =>
          ch`dateDiff(${ch.param("String", input.period)}, starts.cohort_start, returns.return_period)
                >= ${ch.param("UInt8", interval)}`,
        () =>
          ch`dateDiff(${ch.param("String", input.period)}, starts.cohort_start, returns.return_period)
                = ${ch.param("UInt8", interval)}`,
      );
      return ch`uniqExactIf(
        starts.person_key,
        notEmpty(returns.person_key) AND ${intervalCondition}
      ) AS ${ch.literal(`interval_${interval}`)}`;
    });
    const rows = yield* ch.withClickhouseSettings(
      ch<EventRetentionRow>`
        WITH
          starts AS (${starts}),
          returns AS (${returns})
        SELECT
          starts.cohort_start AS cohort_start,
          uniqExact(starts.person_key) AS cohort_size,
          ${joinSqlFragments(ch, intervalCounts)}
        FROM starts
        LEFT JOIN returns
          ON returns.person_key = starts.person_key
          AND returns.return_period >= starts.cohort_start
          AND dateDiff(
            ${ch.param("String", input.period)},
            starts.cohort_start,
            returns.return_period
          ) < ${ch.param("UInt8", input.intervals)}
        GROUP BY cohort_start
        ORDER BY cohort_start ASC
      `,
      tenantSettings(input.organizationId),
    );

    return rows.flatMap((row) => {
      const cohortStart = parsePeriod(row.cohort_start);
      if (!cohortStart) return [];
      return [
        {
          cohortSize: Number(row.cohort_size ?? 0),
          cohortStart,
          counts: Array.from({ length: input.intervals }, (_, interval) =>
            Number(row[`interval_${interval}`] ?? 0),
          ),
        },
      ];
    });
  });

export interface EventPathsQueryInput extends AnalyticsActorQueryInput {
  readonly definition: PathsInsightQueryType;
  readonly filters: CompiledAnalyticsFilter;
  readonly organizationId: string;
  readonly params: Pick<TimeRangeParams, "endDate" | "startDate">;
}

export interface EventPathLink {
  readonly averageTransitionSeconds: number;
  readonly count: number;
  readonly source: string;
  readonly sourceStep: number;
  readonly target: string;
  readonly targetStep: number;
}

interface EventPathRow {
  average_transition_seconds: string | number;
  count: string | number;
  source: string;
  source_step: string | number;
  target: string;
  target_step: string | number;
}

/** Query adjacent event transitions from bounded, identity-stitched user sessions. */
export const getEventPathLinks = (input: EventPathsQueryInput) =>
  Effect.gen(function* () {
    const ch = yield* ClickhouseWebClient.ClickhouseWebClient;
    const definition = input.definition;
    const includeEvents = branch(
      definition.eventNames.length > 0,
      () => ch`AND event_name IN ${ch.param("Array(String)", [...definition.eventNames])}`,
      () => ch``,
    );
    const dedupedEvents = resolvedEventsFrom(
      ch,
      ch`project_id IN ${ch.param("Array(String)", input.filters.projectIds)}
          AND event_ts >= ${ch.param("DateTime", toClickhouseDateTime(input.params.startDate))}
          AND event_ts <= ${ch.param("DateTime", toClickhouseDateTime(input.params.endDate))}
          ${includeEvents}`,
    );
    const actorKey = analyticsActorKey(ch, input.actor);
    const actorFilter = analyticsActorFilter(ch, input);
    const pathItem = branch(
      definition.pathItem === "screen_name",
      () => ch`${ch.literal(jsonString("$screen_name", "screen_name", "screenName"))}`,
      () => ch`${ch.literal(`${EVENT_ALIAS}.event_name`)}`,
    );
    const propertyFilter = whenDefined(
      definition.filters,
      (filters) => buildCustomEventFilter(ch, filters),
      () => ch`1 = 1`,
    );
    const excludeEventNames = definition.excludeEventNames;
    const excludePathItems = branch(
      (excludeEventNames?.length ?? 0) > 0,
      () => ch`AND ${pathItem} NOT IN ${ch.param("Array(String)", [...(excludeEventNames ?? [])])}`,
      () => ch``,
    );
    const sessionGapSeconds = definition.sessionGapSeconds ?? 1_800;
    const orderedEvents = ch`
      SELECT
        ${actorKey} AS person_key,
        ${pathItem} AS path_item,
        ${ch.literal(EVENT_TS)} AS path_time,
        ${ch.literal(`${EVENT_ALIAS}.event_id`)} AS event_id
      ${dedupedEvents}
      ${ch.literal(RESOLVED_EVENTS_JOIN)}
      WHERE ${propertyFilter} AND ${actorFilter} ${excludePathItems}
      ORDER BY person_key ASC, path_time ASC, event_id ASC
    `;
    const sessions = ch`
      SELECT
        person_key,
        arraySplit(
          item -> item.3 > ${ch.param("UInt32", sessionGapSeconds)},
          arrayZip(
            path_items,
            path_times,
            arrayDifference(arrayMap(value -> toUInt64(toUnixTimestamp(value)), path_times))
          )
        ) AS sessions
      FROM (
        SELECT
          person_key,
          groupArray(path_item) AS path_items,
          groupArray(path_time) AS path_times
        FROM (${orderedEvents})
        WHERE notEmpty(path_item)
        GROUP BY person_key
      )
    `;
    const compactPath = branch(
      definition.collapseRepeated === false,
      () => ch`session`,
      () => ch`arrayFilter(
            (item, item_index) -> item_index = 1
              OR tupleElement(item, 1) != tupleElement(session[item_index - 1], 1),
            session,
            arrayEnumerate(session)
          )`,
    );
    const compactedPaths = ch`
      SELECT
        person_key,
        ${compactPath} AS compact_path
      FROM (${sessions})
      ARRAY JOIN sessions AS session
      WHERE length(session) >= 2
    `;
    const startEventName = definition.startEventName;
    const endEventName = definition.endEventName;
    const hasStart = Boolean(startEventName);
    const hasEnd = Boolean(endEventName);
    const startIndex = branch(
      hasStart,
      () => ch`indexOf(path_names, ${ch.param("String", startEventName ?? "")})`,
      () => ch`1`,
    );
    const endIndexWithinStart = branch(
      hasStart,
      () => ch`if(
            indexOf(
              arraySlice(path_names, start_index),
              ${ch.param("String", endEventName ?? "")}
            ) > 0,
            indexOf(
              arraySlice(path_names, start_index),
              ${ch.param("String", endEventName ?? "")}
            ) + start_index - 1,
            0
          )`,
      () => ch`indexOf(path_names, ${ch.param("String", endEventName ?? "")})`,
    );
    const endIndex = branch(
      hasEnd,
      () => endIndexWithinStart,
      () => ch`length(path_names)`,
    );
    const prefixSteps = Math.ceil((definition.maxDepth - 1) / 2);
    const suffixSteps = Math.floor((definition.maxDepth - 1) / 2);
    const selectedPathWithoutStart = branch(
      hasEnd,
      () => ch`arraySlice(
                compact_path,
                greatest(1, end_index - ${ch.param("UInt8", definition.maxDepth)} + 1),
                least(${ch.param("UInt8", definition.maxDepth)}, end_index)
              )`,
      () => ch`arraySlice(compact_path, 1, ${ch.param("UInt8", definition.maxDepth)})`,
    );
    const selectedPathWithStart = branch(
      hasEnd,
      () => ch`if(
            end_index - start_index + 1 <= ${ch.param("UInt8", definition.maxDepth)},
            arraySlice(compact_path, start_index, end_index - start_index + 1),
            arrayConcat(
              arraySlice(compact_path, start_index, ${ch.param("UInt8", prefixSteps)}),
              [tuple(
                '…',
                tupleElement(compact_path[end_index - ${ch.param("UInt8", suffixSteps)} + 1], 2),
                toInt64(0)
              )],
              arraySlice(
                compact_path,
                end_index - ${ch.param("UInt8", suffixSteps)} + 1,
                ${ch.param("UInt8", suffixSteps)}
              )
            )
          )`,
      () => ch`arraySlice(compact_path, start_index, ${ch.param("UInt8", definition.maxDepth)})`,
    );
    const selectedPath = branch(
      hasStart,
      () => selectedPathWithStart,
      () => selectedPathWithoutStart,
    );
    const endpointConditions = [
      ...branch(
        hasStart,
        () => [ch`start_index > 0`],
        () => [],
      ),
      ...branch(
        hasEnd,
        () => [ch`end_index > 0`],
        () => [],
      ),
      ...branch(
        hasStart && hasEnd,
        () => [ch`end_index >= start_index`],
        () => [],
      ),
    ];
    const endpointWhere = branch(
      endpointConditions.length > 0,
      () => joinSqlFragments(ch, endpointConditions, " AND "),
      () => ch`1 = 1`,
    );
    const selectedPaths = ch`
      SELECT
        person_key,
        ${selectedPath} AS selected_path
      FROM (
        SELECT
          person_key,
          compact_path,
          arrayMap(item -> item.1, compact_path) AS path_names,
          ${startIndex} AS start_index,
          ${endIndex} AS end_index
        FROM (${compactedPaths})
      )
      WHERE ${endpointWhere}
    `;
    const edgeRows = ch`
      SELECT
        tupleElement(selected_path[target_step - 1], 1) AS source,
        target_step - 1 AS source_step,
        tupleElement(selected_path[target_step], 1) AS target,
        target_step AS target_step,
        dateDiff(
          'second',
          tupleElement(selected_path[target_step - 1], 2),
          tupleElement(selected_path[target_step], 2)
        ) AS transition_seconds
      FROM (${selectedPaths})
      ARRAY JOIN arrayEnumerate(selected_path) AS target_step
      WHERE target_step > 1
    `;
    const minEdgeCount = definition.minEdgeCount;
    const maxEdgeCount = definition.maxEdgeCount;
    const edgeConditions = [
      ...branch(
        Boolean(minEdgeCount),
        () => [ch`count() >= ${ch.param("UInt32", minEdgeCount)}`],
        () => [],
      ),
      ...branch(
        Boolean(maxEdgeCount),
        () => [ch`count() <= ${ch.param("UInt32", maxEdgeCount)}`],
        () => [],
      ),
    ];
    const edgeHaving = branch(
      edgeConditions.length > 0,
      () => ch`HAVING ${joinSqlFragments(ch, edgeConditions, " AND ")}`,
      () => ch``,
    );
    const rows = yield* ch.withClickhouseSettings(
      ch<EventPathRow>`
        SELECT
          source,
          source_step,
          target,
          target_step,
          count() AS count,
          avg(transition_seconds) AS average_transition_seconds
        FROM (${edgeRows})
        GROUP BY source, source_step, target, target_step
        ${edgeHaving}
        ORDER BY count DESC, source_step ASC, source ASC, target ASC
        LIMIT ${ch.param("UInt16", definition.edgeLimit ?? 50)}
      `,
      tenantSettings(input.organizationId),
    );

    return rows.map((row) => ({
      averageTransitionSeconds: Number(row.average_transition_seconds ?? 0),
      count: Number(row.count ?? 0),
      source: row.source,
      sourceStep: Number(row.source_step),
      target: row.target,
      targetStep: Number(row.target_step),
    }));
  });

export interface EventStickinessQueryInput extends AnalyticsActorQueryInput {
  readonly filters: CompiledAnalyticsFilter;
  readonly interval: StickinessInsightQueryType["interval"];
  readonly occurrenceCriteria: NonNullable<StickinessInsightQueryType["occurrenceCriteria"]>;
  readonly organizationId: string;
  readonly params: Pick<TimeRangeParams, "endDate" | "startDate">;
  readonly series: StickinessInsightQueryType["series"][number];
}

export interface EventStickinessBucket {
  readonly count: number;
  readonly intervals: number;
}

interface EventStickinessRow {
  active_intervals: string | number;
  actor_count: string | number;
}

/** Renders the per-interval occurrence predicate a stickiness bucket must satisfy. */
const stickinessOccurrenceCondition = (
  ch: ClickhouseWebClient.ClickhouseWebClient,
  criteria: EventStickinessQueryInput["occurrenceCriteria"],
): SqlFragment => {
  switch (criteria.operator) {
    case "exact":
      return ch`count() = ${ch.param("UInt16", criteria.value)}`;
    case "lte":
      return ch`count() <= ${ch.param("UInt16", criteria.value)}`;
    default:
      return ch`count() >= ${ch.param("UInt16", criteria.value)}`;
  }
};

/** Query the exact activity-frequency distribution for an identity-stitched event series. */
export const getEventStickinessBuckets = (input: EventStickinessQueryInput) =>
  Effect.gen(function* () {
    const ch = yield* ClickhouseWebClient.ClickhouseWebClient;
    const periodExpression = getDateTruncExpression(EVENT_TS, input.interval);
    const actorKey = analyticsActorKey(ch, input.actor);
    const actorFilter = analyticsActorFilter(ch, input);
    const propertyFilter = whenDefined(
      input.series.filters,
      (filters) => buildCustomEventFilter(ch, filters),
      () => ch`1 = 1`,
    );
    const occurrenceCondition = stickinessOccurrenceCondition(ch, input.occurrenceCriteria);
    const dedupedEvents = resolvedEventsFrom(
      ch,
      ch`project_id IN ${ch.param("Array(String)", input.filters.projectIds)}
          AND event_ts >= ${ch.param("DateTime", toClickhouseDateTime(input.params.startDate))}
          AND event_ts <= ${ch.param("DateTime", toClickhouseDateTime(input.params.endDate))}
          AND event_name IN ${ch.param("Array(String)", [...input.series.eventNames])}`,
    );
    const rows = yield* ch.withClickhouseSettings(
      ch<EventStickinessRow>`
        SELECT
          active_intervals,
          count() AS actor_count
        FROM (
          SELECT
            person_key,
            count() AS active_intervals
          FROM (
            SELECT
              ${actorKey} AS person_key,
              ${ch.literal(periodExpression)} AS active_period
            ${dedupedEvents}
            ${ch.literal(RESOLVED_EVENTS_JOIN)}
            WHERE ${propertyFilter} AND ${actorFilter}
            GROUP BY person_key, active_period
            HAVING ${occurrenceCondition}
          )
          GROUP BY person_key
        )
        GROUP BY active_intervals
        ORDER BY active_intervals ASC
      `,
      tenantSettings(input.organizationId),
    );

    return rows.flatMap((row) => {
      const intervals = Number(row.active_intervals);
      const count = Number(row.actor_count);
      if (!Number.isSafeInteger(intervals) || intervals <= 0 || !Number.isFinite(count)) return [];
      return [{ count, intervals }];
    });
  });

export interface EventLifecycleQueryInput extends AnalyticsActorQueryInput {
  readonly filters: CompiledAnalyticsFilter;
  readonly granularity: LifecycleInsightQueryType["granularity"];
  readonly organizationId: string;
  readonly params: Pick<TimeRangeParams, "endDate" | "startDate">;
  readonly series: LifecycleInsightQueryType["series"];
}

export interface EventLifecyclePoint {
  readonly count: number;
  readonly status: "dormant" | "new" | "resurrecting" | "returning";
  readonly timestamp: Date;
}

interface EventLifecycleRow {
  count: string | number;
  period: string | Date;
  status: EventLifecyclePoint["status"];
}

const startOfLifecycleInterval = (
  date: Date,
  granularity: EventLifecycleQueryInput["granularity"],
): Date => {
  const value = DateTime.makeUnsafe(date);
  if (granularity === "hour") return DateTime.toDateUtc(DateTime.startOf(value, "hour"));
  if (granularity === "day") return DateTime.toDateUtc(DateTime.startOf(value, "day"));
  if (granularity === "week") {
    // ISO weeks start on Monday, matching the previous `(getUTCDay() + 6) % 7` shift.
    return DateTime.toDateUtc(DateTime.startOf(value, "week", { weekStartsOn: 1 }));
  }
  return DateTime.toDateUtc(DateTime.startOf(value, "month"));
};

/** The ClickHouse expression that advances a lifecycle period by one interval. */
const addLifecycleIntervalExpression = (
  granularity: EventLifecycleQueryInput["granularity"],
): string => {
  switch (granularity) {
    case "hour":
      return "addHours(current_period, 1)";
    case "day":
      return "addDays(current_period, 1)";
    case "week":
      return "addWeeks(current_period, 1)";
    default:
      return "addMonths(current_period, 1)";
  }
};

/** Query new, returning, resurrecting, and dormant people for an event series. */
export const getEventLifecyclePoints = (input: EventLifecycleQueryInput) =>
  Effect.gen(function* () {
    const ch = yield* ClickhouseWebClient.ClickhouseWebClient;
    const periodExpression = getDateTruncExpression(EVENT_TS, input.granularity);
    const isGroupActor = input.actor?.kind === "group";
    const actorKey = branch(
      isGroupActor,
      () => analyticsActorKey(ch, input.actor),
      () => ch`${ch.literal(effectivePersonIdExpression)}`,
    );
    const actorFilter = branch(
      isGroupActor,
      () => analyticsActorFilter(ch, input),
      () => ch`${analyticsActorFilter(ch, input)}
            AND notEmpty(${ch.literal(effectivePersonIdExpression)})`,
    );
    const propertyFilter = whenDefined(
      input.series.filters,
      (filters) => buildCustomEventFilter(ch, filters),
      () => ch`1 = 1`,
    );
    const matchingActivity = ch`(
      ${ch.literal(`${EVENT_ALIAS}.event_name`)} IN ${ch.param("Array(String)", [
        ...input.series.eventNames,
      ])}
      AND ${propertyFilter}
    )`;
    const dedupedEvents = resolvedEventsFrom(
      ch,
      ch`project_id IN ${ch.param("Array(String)", input.filters.projectIds)}
          AND event_ts <= ${ch.param("DateTime", toClickhouseDateTime(input.params.endDate))}`,
    );
    const actorActivity = ch`
      SELECT
        ${actorKey} AS person_key,
        min(${ch.literal(periodExpression)}) AS first_seen_period,
        arraySort(
          groupUniqArrayIf(${ch.literal(periodExpression)}, ${matchingActivity})
        ) AS activity_periods
      ${dedupedEvents}
      ${ch.literal(RESOLVED_EVENTS_JOIN)}
      WHERE ${actorFilter}
      GROUP BY person_key
      HAVING notEmpty(activity_periods)
    `;
    const activeRows = ch`
      SELECT
        person_key,
        activity_periods[activity_index] AS period,
        multiIf(
          period = first_seen_period,
          'new',
          activity_index > 1 AND dateDiff(
            ${ch.param("String", input.granularity)},
            activity_periods[activity_index - 1],
            period
          ) = 1,
          'returning',
          'resurrecting'
        ) AS status
      FROM (${actorActivity})
      ARRAY JOIN arrayEnumerate(activity_periods) AS activity_index
    `;
    const addIntervalExpression = addLifecycleIntervalExpression(input.granularity);
    const dormantRows = ch`
      SELECT
        person_key,
        ${ch.literal(addIntervalExpression)} AS period,
        'dormant' AS status
      FROM (
        SELECT
          person_key,
          activity_periods,
          activity_index,
          activity_periods[activity_index] AS current_period
        FROM (${actorActivity})
        ARRAY JOIN arrayEnumerate(activity_periods) AS activity_index
      )
      WHERE activity_index = length(activity_periods)
        OR dateDiff(
          ${ch.param("String", input.granularity)},
          current_period,
          activity_periods[activity_index + 1]
        ) > 1
    `;
    const rangeStart = startOfLifecycleInterval(input.params.startDate, input.granularity);
    const rangeEnd = startOfLifecycleInterval(input.params.endDate, input.granularity);
    const rows = yield* ch.withClickhouseSettings(
      ch<EventLifecycleRow>`
        SELECT
          period,
          status,
          uniqExact(person_key) AS count
        FROM (
          ${activeRows}
          UNION ALL
          ${dormantRows}
        )
        WHERE period >= ${ch.param("DateTime", toClickhouseDateTime(rangeStart))}
          AND period <= ${ch.param("DateTime", toClickhouseDateTime(rangeEnd))}
        GROUP BY period, status
        ORDER BY period ASC, status ASC
      `,
      tenantSettings(input.organizationId),
    );

    return rows.flatMap((row) => {
      const timestamp = parsePeriod(row.period);
      if (!timestamp) return [];
      return [{ count: Number(row.count ?? 0), status: row.status, timestamp }];
    });
  });

export interface AnalyticsQueryInput {
  filters: CompiledAnalyticsFilter;
  organizationId: string;
  params: TimeRangeParams;
}

export interface AnalyticsDataAccessor {
  getRevenue: (
    input: AnalyticsQueryInput,
  ) => Effect.Effect<AnalyticsDataPoint[], SqlError, ClickhouseWebClient.ClickhouseWebClient>;
  getMRR: (
    input: AnalyticsQueryInput,
  ) => Effect.Effect<AnalyticsDataPoint[], SqlError, ClickhouseWebClient.ClickhouseWebClient>;
  getChurnedRevenue: (
    input: AnalyticsQueryInput,
  ) => Effect.Effect<AnalyticsDataPoint[], SqlError, ClickhouseWebClient.ClickhouseWebClient>;
  getActiveSubscriptions: (
    input: AnalyticsQueryInput,
  ) => Effect.Effect<AnalyticsDataPoint[], SqlError, ClickhouseWebClient.ClickhouseWebClient>;
  getActiveTrials: (
    input: AnalyticsQueryInput,
  ) => Effect.Effect<AnalyticsDataPoint[], SqlError, ClickhouseWebClient.ClickhouseWebClient>;
  getNewSubscriptions: (
    input: AnalyticsQueryInput,
  ) => Effect.Effect<AnalyticsDataPoint[], SqlError, ClickhouseWebClient.ClickhouseWebClient>;
  getChurnedSubscriptions: (
    input: AnalyticsQueryInput,
  ) => Effect.Effect<AnalyticsDataPoint[], SqlError, ClickhouseWebClient.ClickhouseWebClient>;
  getTrials: (
    input: AnalyticsQueryInput,
  ) => Effect.Effect<AnalyticsDataPoint[], SqlError, ClickhouseWebClient.ClickhouseWebClient>;
  getTrialConversions: (
    input: AnalyticsQueryInput,
  ) => Effect.Effect<AnalyticsDataPoint[], SqlError, ClickhouseWebClient.ClickhouseWebClient>;
  getPersonCount: (
    input: AnalyticsQueryInput,
  ) => Effect.Effect<AnalyticsDataPoint[], SqlError, ClickhouseWebClient.ClickhouseWebClient>;
  getNewPersons: (
    input: AnalyticsQueryInput,
  ) => Effect.Effect<AnalyticsDataPoint[], SqlError, ClickhouseWebClient.ClickhouseWebClient>;
  getPayingPersonCount: (
    input: AnalyticsQueryInput,
  ) => Effect.Effect<AnalyticsDataPoint[], SqlError, ClickhouseWebClient.ClickhouseWebClient>;
}

const getRevenue = (input: AnalyticsQueryInput) =>
  eventMetric({
    ...input,
    aggregateExpression: `coalesce(sum(${amountCentsExpression}), 0)`,
    eventNames: ["$purchase.completed", "$subscription.created", "$subscription.renewed"],
  }).pipe(Effect.map(moneyPoints));

const getMRR = (input: AnalyticsQueryInput) =>
  eventMetric({
    ...input,
    aggregateExpression: `coalesce(sum(${amountCentsExpression}), 0)`,
    eventNames: ["$subscription.created", "$subscription.renewed"],
    extraWhere: `AND ${jsonBool("is_trial", "isTrial")} = 0`,
  }).pipe(Effect.map(moneyPoints));

const getChurnedRevenue = (input: AnalyticsQueryInput) =>
  eventMetric({
    ...input,
    aggregateExpression: `coalesce(sum(${amountCentsExpression}), 0)`,
    eventNames: ["$subscription.canceled", "$subscription.expired"],
  }).pipe(Effect.map(moneyPoints));

const getActiveSubscriptions = (input: AnalyticsQueryInput) =>
  eventMetric({
    ...input,
    aggregateExpression: `countDistinct(${subscriptionIdExpression})`,
    eventNames: ["$subscription.created", "$subscription.renewed", "$subscription.active"],
    extraWhere: `AND ${jsonBool("is_trial", "isTrial")} = 0`,
  });

const getActiveTrials = (input: AnalyticsQueryInput) =>
  eventMetric({
    ...input,
    aggregateExpression: `countDistinct(${subscriptionIdExpression})`,
    eventNames: ["$subscription.created", "$subscription.renewed", "$subscription.active"],
    extraWhere: `AND ${jsonBool("is_trial", "isTrial")} = 1`,
  });

const getNewSubscriptions = (input: AnalyticsQueryInput) =>
  eventMetric({
    ...input,
    aggregateExpression: "count()",
    eventNames: ["$subscription.created"],
    extraWhere: `AND ${jsonBool("is_trial", "isTrial")} = 0`,
  });

const getChurnedSubscriptions = (input: AnalyticsQueryInput) =>
  eventMetric({
    ...input,
    aggregateExpression: "count()",
    eventNames: ["$subscription.canceled", "$subscription.expired"],
  });

const getTrials = (input: AnalyticsQueryInput) =>
  eventMetric({
    ...input,
    aggregateExpression: "count()",
    eventNames: ["$subscription.created"],
    extraWhere: `AND ${jsonBool("is_trial", "isTrial")} = 1`,
  });

const getTrialConversions = (input: AnalyticsQueryInput) =>
  eventMetric({
    ...input,
    aggregateExpression: `countDistinct(${subscriptionIdExpression})`,
    eventNames: ["$subscription.created", "$subscription.renewed", "$subscription.active"],
    extraWhere: `AND ${jsonBool("converted_from_trial", "convertedFromTrial")} = 1`,
  });

const getPersonCount = ({ params, filters, organizationId }: AnalyticsQueryInput) =>
  Effect.gen(function* () {
    const ch = yield* ClickhouseWebClient.ClickhouseWebClient;
    const period = getDateTruncExpression("first_seen", params.granularity);
    const effectivePersonKey = `coalesce(${effectivePersonIdExpression}, ${effectiveDistinctIdExpression})`;

    const rows = yield* ch.withClickhouseSettings(
      ch<AnalyticsRow>`
        SELECT
          ${ch.literal(period)} AS period,
          count() AS total
        FROM (
          SELECT
            ${ch.literal(effectivePersonKey)} AS person_key,
            min(${ch.literal(EVENT_TS)}) AS first_seen
          ${resolvedEventsFrom(
            ch,
            ch`project_id IN ${ch.param("Array(String)", filters.projectIds)}
            AND event_ts <= ${ch.param("DateTime", toClickhouseDateTime(params.endDate))}`,
          )}
          ${ch.literal(RESOLVED_EVENTS_JOIN)}
          GROUP BY person_key
        )
        GROUP BY period
        ORDER BY period ASC
      `,
      tenantSettings(organizationId),
    );

    return parseRowsToDataPoints(rows);
  });

const getNewPersons = ({ params, filters, organizationId }: AnalyticsQueryInput) =>
  Effect.gen(function* () {
    const ch = yield* ClickhouseWebClient.ClickhouseWebClient;
    const period = getDateTruncExpression("first_seen", params.granularity);
    const effectivePersonKey = `coalesce(${effectivePersonIdExpression}, ${effectiveDistinctIdExpression})`;

    const rows = yield* ch.withClickhouseSettings(
      ch<AnalyticsRow>`
        SELECT
          ${ch.literal(period)} AS period,
          count() AS total
        FROM (
          SELECT
            ${ch.literal(effectivePersonKey)} AS person_key,
            min(${ch.literal(EVENT_TS)}) AS first_seen
          ${resolvedEventsFrom(
            ch,
            ch`project_id IN ${ch.param("Array(String)", filters.projectIds)}
            AND event_ts <= ${ch.param("DateTime", toClickhouseDateTime(params.endDate))}`,
          )}
          ${ch.literal(RESOLVED_EVENTS_JOIN)}
          GROUP BY person_key
        )
        WHERE first_seen >= ${ch.param("DateTime", toClickhouseDateTime(params.startDate))}
          AND first_seen <= ${ch.param("DateTime", toClickhouseDateTime(params.endDate))}
        GROUP BY period
        ORDER BY period ASC
      `,
      tenantSettings(organizationId),
    );

    return parseRowsToDataPoints(rows);
  });

const getPayingPersonCount = (input: AnalyticsQueryInput) =>
  eventMetric({
    ...input,
    aggregateExpression: `countDistinct(${effectivePersonIdExpression})`,
    eventNames: ["$purchase.completed", "$subscription.created", "$subscription.renewed"],
    extraWhere: `AND ${amountCentsExpression} > 0`,
  });

export interface ExperimentVariantResultRow {
  readonly variant: string;
  readonly exposures: number | string;
  readonly conversions: number | string;
  readonly revenue_cents: number | string;
}

/**
 * Per-variant experiment funnel: distinct exposed persons, distinct persons who
 * fired a primary-metric event AFTER their first exposure, and post-exposure
 * revenue (USD minor units). Exposures→conversions join on the identity-stitched
 * person key (`coalesce(effectivePersonId, effectiveDistinctId)`) so an
 * anonymous→identified user isn't undercounted, and events are deduped by
 * `event_id` (latest-wins). Org-scoped by the readonly row policy. NOT a
 * `BUILT_IN_INSIGHT` (those forbid the per-variant breakdown).
 *
 * Reads `$experiment.exposed` events (emitted server-side); returns no rows
 * until exposure emission is producing events. NEEDS live-ClickHouse
 * verification (value-level correctness cannot be checked by typecheck).
 */
export const getExperimentResults = (input: {
  readonly organizationId: string;
  readonly projectId: string;
  readonly experimentId: string;
  readonly primaryMetricEventNames: readonly string[];
  readonly revenueEventNames: readonly string[];
  readonly startDate: Date;
  readonly endDate: Date;
}) =>
  Effect.gen(function* () {
    const ch = yield* ClickhouseWebClient.ClickhouseWebClient;
    const personKey = `coalesce(${effectivePersonIdExpression}, ${effectiveDistinctIdExpression})`;
    const variantExpr = `JSONExtractString(${EVENT_PROPERTIES}, 'variantKey')`;
    const startTs = toClickhouseDateTime(input.startDate);
    const endTs = toClickhouseDateTime(input.endDate);
    const conversionEventNames = [
      ...new Set([...input.primaryMetricEventNames, ...input.revenueEventNames]),
    ];

    const exposuresFrom = resolvedEventsFrom(
      ch,
      ch`project_id IN ${ch.param("Array(String)", [input.projectId])}
          AND event_ts >= ${ch.param("DateTime", startTs)}
          AND event_ts <= ${ch.param("DateTime", endTs)}
          AND event_name = ${ch.param("String", "$experiment.exposed")}
          AND JSONExtractString(event_properties, 'experimentId') = ${ch.param("String", input.experimentId)}`,
    );
    const conversionsFrom = resolvedEventsFrom(
      ch,
      ch`project_id IN ${ch.param("Array(String)", [input.projectId])}
          AND event_ts >= ${ch.param("DateTime", startTs)}
          AND event_ts <= ${ch.param("DateTime", endTs)}
          AND event_name IN ${ch.param("Array(String)", conversionEventNames)}`,
    );

    return yield* ch.withClickhouseSettings(
      ch<ExperimentVariantResultRow>`
        WITH
          exposures AS (
            SELECT
              ${ch.literal(personKey)} AS person_key,
              argMin(${ch.literal(variantExpr)}, ${ch.literal(EVENT_TS)}) AS variant,
              min(${ch.literal(EVENT_TS)}) AS first_ts
            ${exposuresFrom}
            ${ch.literal(RESOLVED_EVENTS_JOIN)}
            GROUP BY person_key
          ),
          conversions AS (
            SELECT
              ${ch.literal(personKey)} AS person_key,
              ${ch.literal(`${EVENT_ALIAS}.event_name`)} AS conv_event_name,
              ${ch.literal(EVENT_TS)} AS conv_ts,
              ${ch.literal(amountCentsExpression)} AS amount_cents
            ${conversionsFrom}
            ${ch.literal(RESOLVED_EVENTS_JOIN)}
          )
        SELECT
          exposures.variant AS variant,
          countDistinct(exposures.person_key) AS exposures,
          countDistinctIf(
            conversions.person_key,
            conversions.conv_ts >= exposures.first_ts
              AND conversions.conv_event_name IN ${ch.param("Array(String)", [...input.primaryMetricEventNames])}
          ) AS conversions,
          coalesce(sumIf(
            conversions.amount_cents,
            conversions.conv_ts >= exposures.first_ts
              AND conversions.conv_event_name IN ${ch.param("Array(String)", [...input.revenueEventNames])}
          ), 0) AS revenue_cents
        FROM exposures
        LEFT JOIN conversions ON conversions.person_key = exposures.person_key
        GROUP BY variant
        ORDER BY variant ASC
      `,
      tenantSettings(input.organizationId),
    );
  });

export const analyticsAccessor: AnalyticsDataAccessor = {
  getActiveSubscriptions,
  getActiveTrials,
  getChurnedRevenue,
  getChurnedSubscriptions,
  getMRR,
  getNewPersons,
  getNewSubscriptions,
  getPayingPersonCount,
  getPersonCount,
  getRevenue,
  getTrialConversions,
  getTrials,
};

export {
  CLICKHOUSE_EVENTS_FULL_TABLE,
  CLICKHOUSE_PERSONS_FULL_TABLE,
  CLICKHOUSE_PENDING_OVERRIDES_FULL_TABLE,
  // Reused verbatim by the VoidQL `events`/`revenue` logical-view lowering so the
  // dedup + identity-resolution machinery is single-sourced (docs/analytics-access-layer.html §9).
  RESOLVED_EVENTS_JOIN,
  effectivePersonIdExpression,
  effectiveDistinctIdExpression,
  toClickhouseDateTime,
};
