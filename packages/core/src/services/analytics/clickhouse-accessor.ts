/**
 * ClickHouse data-access layer for the analytics service: the 12 metric query
 * helpers consumed by `series-resolver`, exposed as {@link analyticsAccessor}.
 * Each returns `ReadonlyArray<AnalyticsDataPoint>` with the period column
 * normalised to `Date`.
 */
import { Effect } from "effect";

import type {
  AnalyticsDataPoint,
  CompiledAnalyticsFilter,
  TimeGranularity,
  TimeRangeParams,
} from "../../domain/analytics/Analytics.ts";
import { ClickhouseWebClient } from "@voidhash/clickhouse-db/clickhouse-client-web";
import type { SqlError } from "effect/unstable/sql/SqlError";

// Unqualified table names — the runtime Clickhouse client connects with the
// per-stage database (provisioned by `Clickhouse.Database`) as its default,
// so these resolve correctly without a hardcoded database prefix.
const CLICKHOUSE_EVENTS_FULL_TABLE = "events_v2" as const;
const CLICKHOUSE_PERSONS_FULL_TABLE = "persons_v1" as const;
const CLICKHOUSE_PENDING_OVERRIDES_FULL_TABLE = "person_identity_pending_overrides_v2" as const;

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

const parsePeriod = (value: unknown): Date | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;
    const normalized = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
    const withZone = /(?:Z|[+-]\d{2}:\d{2})$/.test(normalized) ? normalized : `${normalized}Z`;
    const parsed = new Date(withZone);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

const parseRowsToDataPoints = (rows: ReadonlyArray<AnalyticsRow>): AnalyticsDataPoint[] =>
  rows.flatMap((row) => {
    const timestamp = parsePeriod(row.period);
    if (!timestamp) return [];
    const value = Number(row.total ?? 0);
    return [{ timestamp, value: Number.isFinite(value) ? value : 0 }];
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
    { values: filters.productIds, expression: productIdExpression, kind: "String" as const },
    {
      values: filters.providerEnvironments,
      expression: providerEnvironmentExpression,
      kind: "Float64" as const,
    },
    {
      values: filters.subscriptionStatuses,
      expression: subscriptionStatusExpression,
      kind: "Float64" as const,
    },
  ];
  return terms.reduce(
    (acc, term) =>
      term.values && term.values.length > 0
        ? ch`${acc}
        AND ${ch.literal(term.expression)} IN ${ch.param(`Array(${term.kind})`, term.values)}`
        : acc,
    ch``,
  );
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
  readonly experimentKey: string;
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
          AND JSONExtractString(event_properties, 'experimentKey') = ${ch.param("String", input.experimentKey)}`,
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
