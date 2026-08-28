export interface ClickHouseAnalyticsMigration {
  readonly id: string;
  readonly statements: ReadonlyArray<string>;
}

/** OSS ClickHouse schema for the unified ingest and query adapters. */
export const CLICKHOUSE_ANALYTICS_MIGRATIONS: ReadonlyArray<ClickHouseAnalyticsMigration> = [
  {
    id: "0001_analytics_events",
    statements: [
      `CREATE TABLE IF NOT EXISTS events_v2 (
        event_id String,
        capture_id String,
        event_name LowCardinality(String),
        event_ts DateTime64(3, 'UTC'),
        received_ts DateTime64(3, 'UTC'),
        processed_ts DateTime64(3, 'UTC'),
        inserted_ts DateTime64(3, 'UTC'),
        organization_id String,
        project_id String,
        distinct_id String,
        previous_distinct_id Nullable(String),
        person_id Nullable(String),
        identity_mode LowCardinality(String),
        event_properties String,
        context String,
        token String,
        request_id String,
        request_path String,
        session_id Nullable(String),
        schema_version UInt16,
        source_offset String,
        source_partition Int32,
        source_topic LowCardinality(String)
      ) ENGINE = ReplacingMergeTree(processed_ts)
      PARTITION BY toYYYYMM(event_ts)
      ORDER BY (organization_id, project_id, event_name, event_ts, event_id)`,
    ],
  },
  {
    id: "0002_analytics_identity",
    statements: [
      `CREATE TABLE IF NOT EXISTS persons_v1 (
        organization_id String DEFAULT '',
        project_id String,
        person_id String,
        primary_distinct_id Nullable(String),
        email Nullable(String),
        name Nullable(String),
        traits String,
        is_archived UInt8,
        merged_into_person_id Nullable(String),
        changed_at DateTime64(3, 'UTC'),
        version UInt64
      ) ENGINE = ReplacingMergeTree(version)
      ORDER BY (organization_id, project_id, person_id)`,
      `CREATE TABLE IF NOT EXISTS person_identity_v1 (
        organization_id String DEFAULT '',
        project_id String,
        distinct_id String,
        person_id String,
        previous_distinct_id Nullable(String),
        is_deleted UInt8,
        changed_at DateTime64(3, 'UTC'),
        version UInt64
      ) ENGINE = ReplacingMergeTree(version)
      ORDER BY (organization_id, project_id, distinct_id)`,
      `CREATE TABLE IF NOT EXISTS person_identity_overrides_v1 (
        organization_id String DEFAULT '',
        project_id String,
        distinct_id String,
        previous_distinct_id Nullable(String),
        person_id String,
        is_deleted UInt8,
        changed_at DateTime64(3, 'UTC'),
        version UInt64
      ) ENGINE = ReplacingMergeTree(version)
      ORDER BY (organization_id, project_id, distinct_id)`,
      `CREATE TABLE IF NOT EXISTS person_identity_pending_overrides_v2 (
        organization_id String DEFAULT '',
        project_id String,
        source_distinct_id String,
        target_distinct_id String,
        person_id String,
        is_deleted UInt8,
        changed_at DateTime64(3, 'UTC'),
        version UInt64
      ) ENGINE = ReplacingMergeTree(version)
      ORDER BY (organization_id, project_id, source_distinct_id)`,
    ],
  },
  {
    id: "0003_atomic_analytics_writes",
    statements: [
      `CREATE TABLE IF NOT EXISTS analytics_records_v1 (
        write_id String,
        write_ts DateTime64(3, 'UTC'),
        record_type LowCardinality(String),
        record_id String,
        record_version UInt64,
        organization_id String,
        project_id String,
        event_id String DEFAULT '',
        capture_id String DEFAULT '',
        event_name LowCardinality(String) DEFAULT '',
        event_ts DateTime64(3, 'UTC') DEFAULT toDateTime64(0, 3, 'UTC'),
        received_ts DateTime64(3, 'UTC') DEFAULT toDateTime64(0, 3, 'UTC'),
        processed_ts DateTime64(3, 'UTC') DEFAULT toDateTime64(0, 3, 'UTC'),
        inserted_ts DateTime64(3, 'UTC') DEFAULT toDateTime64(0, 3, 'UTC'),
        distinct_id String DEFAULT '',
        previous_distinct_id Nullable(String),
        person_id Nullable(String),
        identity_mode LowCardinality(String) DEFAULT '',
        event_properties String DEFAULT '{}',
        context String DEFAULT '{}',
        token String DEFAULT '',
        request_id String DEFAULT '',
        request_path String DEFAULT '',
        session_id Nullable(String),
        schema_version UInt16 DEFAULT 1,
        source_offset String DEFAULT '',
        source_partition Int32 DEFAULT 0,
        source_topic LowCardinality(String) DEFAULT '',
        primary_distinct_id Nullable(String),
        email Nullable(String),
        name Nullable(String),
        traits String DEFAULT '{}',
        is_archived UInt8 DEFAULT 0,
        merged_into_person_id Nullable(String),
        changed_at DateTime64(3, 'UTC') DEFAULT toDateTime64(0, 3, 'UTC'),
        version UInt64 DEFAULT 0,
        is_deleted UInt8 DEFAULT 0,
        source_distinct_id String DEFAULT '',
        target_distinct_id String DEFAULT ''
      ) ENGINE = ReplacingMergeTree(record_version)
      PARTITION BY toYYYYMM(write_ts)
      ORDER BY (record_type, organization_id, project_id, record_id)
      SETTINGS non_replicated_deduplication_window = 10000`,
      `CREATE VIEW IF NOT EXISTS analytics_events_v2 AS
      SELECT event_id, capture_id, event_name, event_ts, received_ts, processed_ts, inserted_ts,
        organization_id, project_id, distinct_id, previous_distinct_id, person_id, identity_mode,
        event_properties, context, token, request_id, request_path, session_id, schema_version,
        source_offset, source_partition, source_topic
      FROM events_v2
      UNION ALL
      SELECT event_id, capture_id, event_name, event_ts, received_ts, processed_ts, inserted_ts,
        organization_id, project_id, distinct_id, previous_distinct_id, person_id, identity_mode,
        event_properties, context, token, request_id, request_path, session_id, schema_version,
        source_offset, source_partition, source_topic
      FROM analytics_records_v1 WHERE record_type = 'event'`,
      `CREATE VIEW IF NOT EXISTS analytics_persons_v1 AS
      SELECT organization_id, project_id, person_id, primary_distinct_id, email, name, traits,
        is_archived, merged_into_person_id, changed_at, version
      FROM persons_v1
      UNION ALL
      SELECT organization_id, project_id, assumeNotNull(person_id) AS person_id,
        primary_distinct_id, email, name, traits, is_archived, merged_into_person_id, changed_at, version
      FROM analytics_records_v1 WHERE record_type = 'person'`,
      `CREATE VIEW IF NOT EXISTS analytics_person_identity_v1 AS
      SELECT organization_id, project_id, distinct_id, person_id, previous_distinct_id,
        is_deleted, changed_at, version
      FROM person_identity_v1
      UNION ALL
      SELECT organization_id, project_id, distinct_id, assumeNotNull(person_id) AS person_id,
        previous_distinct_id, is_deleted, changed_at, version
      FROM analytics_records_v1 WHERE record_type = 'identity'`,
      `CREATE VIEW IF NOT EXISTS analytics_person_identity_overrides_v1 AS
      SELECT organization_id, project_id, distinct_id, person_id, previous_distinct_id,
        is_deleted, changed_at, version
      FROM person_identity_overrides_v1
      UNION ALL
      SELECT organization_id, project_id, distinct_id, assumeNotNull(person_id) AS person_id,
        previous_distinct_id, is_deleted, changed_at, version
      FROM analytics_records_v1 WHERE record_type = 'identity_override'`,
      `CREATE VIEW IF NOT EXISTS analytics_person_identity_pending_overrides_v2 AS
      SELECT organization_id, project_id, source_distinct_id, target_distinct_id, person_id,
        is_deleted, changed_at, version
      FROM person_identity_pending_overrides_v2
      UNION ALL
      SELECT organization_id, project_id, source_distinct_id, target_distinct_id,
        assumeNotNull(person_id) AS person_id, is_deleted, changed_at, version
      FROM analytics_records_v1 WHERE record_type = 'pending_identity_override'`,
    ],
  },
];
