// ClickHouse analytics tables. Names are unqualified — the runtime client
// connects with a per-stage database (provisioned by `Clickhouse.Database`)
// as its default, so unqualified table references resolve into the correct
// per-stage database without hardcoding the database name here.
export const CLICKHOUSE_EVENTS_TABLE = "events_v2";
export const CLICKHOUSE_PERSONS_TABLE = "persons_v1";
export const CLICKHOUSE_PERSON_IDENTITY_TABLE = "person_identity_v1";
export const CLICKHOUSE_PERSON_IDENTITY_OVERRIDES_TABLE = "person_identity_overrides_v1";
export const CLICKHOUSE_PERSON_IDENTITY_PENDING_OVERRIDES_V2_TABLE =
  "person_identity_pending_overrides_v2";
