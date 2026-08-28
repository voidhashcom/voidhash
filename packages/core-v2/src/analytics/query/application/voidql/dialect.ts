export const CLICKHOUSE_EVENTS_FULL_TABLE = "analytics_events_v2";
export const CLICKHOUSE_PERSONS_FULL_TABLE = "analytics_persons_v1";
export const CLICKHOUSE_PENDING_OVERRIDES_FULL_TABLE =
  "analytics_person_identity_pending_overrides_v2";

const EVENT_ALIAS = "events";
const OVERRIDES_ALIAS = "pending_overrides";

export const effectivePersonIdExpression = `coalesce(nullIf(${OVERRIDES_ALIAS}.person_id, ''), ${EVENT_ALIAS}.person_id)`;
export const effectiveDistinctIdExpression = `coalesce(nullIf(${OVERRIDES_ALIAS}.target_distinct_id, ''), ${EVENT_ALIAS}.distinct_id)`;

/** Format a bound ClickHouse DateTime value without fractional seconds. */
export const toClickhouseDateTime = (date: Date): string =>
  date
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d+Z$/, "");
