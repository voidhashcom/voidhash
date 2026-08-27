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
];
