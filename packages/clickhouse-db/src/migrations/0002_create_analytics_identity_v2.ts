import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

import {
  CLICKHOUSE_EVENTS_TABLE,
  CLICKHOUSE_PERSON_IDENTITY_OVERRIDES_TABLE,
  CLICKHOUSE_PERSON_IDENTITY_TABLE,
  CLICKHOUSE_PERSONS_TABLE,
} from "../analytics/schema.ts";
import { ClickhouseWebClient } from "../clickhouse-client-web/index.ts";

const KAFKA_BROKER_LIST = "redpanda:9092";

export const migration0002Statements = [
  `DROP TABLE IF EXISTS event_processed_v2_mv`,
  `DROP TABLE IF EXISTS event_processed_v2_kafka`,
  `DROP TABLE IF EXISTS ${CLICKHOUSE_EVENTS_TABLE}`,
  `CREATE TABLE ${CLICKHOUSE_EVENTS_TABLE}
	(
		event_id String,
		capture_id String,
		event_name String,
		event_ts DateTime64(3),
		processed_ts DateTime64(3),
		organization_id String,
		project_id String,
		distinct_id String,
		previous_distinct_id Nullable(String),
		person_id Nullable(String),
		identity_mode LowCardinality(String),
		event_properties String,
		context String,
		route_lane LowCardinality(String),
		skip_enrichment UInt8,
		source_offset String,
		source_partition Int32,
		source_topic String,
		token String,
		request_path LowCardinality(String),
		request_id String,
		schema_version UInt8
	)
	ENGINE = MergeTree
	PARTITION BY toYYYYMM(event_ts)
	ORDER BY (project_id, distinct_id, event_ts, event_id)`,
  `CREATE TABLE IF NOT EXISTS ${CLICKHOUSE_PERSONS_TABLE}
	(
		person_id String,
		project_id String,
		primary_distinct_id Nullable(String),
		email Nullable(String),
		name Nullable(String),
		traits String,
		is_archived UInt8,
		merged_into_person_id Nullable(String),
		version UInt64,
		changed_at DateTime64(3)
	)
	ENGINE = ReplacingMergeTree(version)
	PARTITION BY toYYYYMM(changed_at)
	ORDER BY (project_id, person_id)`,
  `CREATE TABLE IF NOT EXISTS ${CLICKHOUSE_PERSON_IDENTITY_TABLE}
	(
		project_id String,
		distinct_id String,
		previous_distinct_id Nullable(String),
		person_id String,
		is_deleted UInt8,
		version UInt64,
		changed_at DateTime64(3)
	)
	ENGINE = ReplacingMergeTree(version)
	PARTITION BY toYYYYMM(changed_at)
	ORDER BY (project_id, distinct_id)`,
  `CREATE TABLE IF NOT EXISTS ${CLICKHOUSE_PERSON_IDENTITY_OVERRIDES_TABLE}
	(
		project_id String,
		distinct_id String,
		previous_distinct_id Nullable(String),
		person_id String,
		is_deleted UInt8,
		version UInt64,
		changed_at DateTime64(3)
	)
	ENGINE = ReplacingMergeTree(version)
	PARTITION BY toYYYYMM(changed_at)
	ORDER BY (project_id, distinct_id)`,
  `CREATE TABLE IF NOT EXISTS event_processed_v2_kafka
	(
		raw String
	)
	ENGINE = Kafka
	SETTINGS
		kafka_broker_list = '${KAFKA_BROKER_LIST}',
		kafka_topic_list = 'event.processed.v2',
		kafka_group_name = 'clickhouse-event-processed-v2',
		kafka_format = 'JSONAsString',
		kafka_num_consumers = 1`,
  `CREATE MATERIALIZED VIEW IF NOT EXISTS event_processed_v2_mv
	TO ${CLICKHOUSE_EVENTS_TABLE}
	AS
	SELECT
		JSONExtractString(raw, 'processedEventId') AS event_id,
		JSONExtractString(raw, 'captureId') AS capture_id,
		JSONExtractString(raw, 'event') AS event_name,
		parseDateTime64BestEffort(JSONExtractString(raw, 'eventTimestamp'), 3) AS event_ts,
		parseDateTime64BestEffort(JSONExtractString(raw, 'processedAt'), 3) AS processed_ts,
		JSONExtractString(raw, 'organizationId') AS organization_id,
		JSONExtractString(raw, 'projectId') AS project_id,
		JSONExtractString(raw, 'identity', 'distinctId') AS distinct_id,
		nullIf(JSONExtractString(raw, 'previousDistinctId'), '') AS previous_distinct_id,
		nullIf(JSONExtractString(raw, 'identity', 'personId'), '') AS person_id,
		JSONExtractString(raw, 'identity', 'mode') AS identity_mode,
		JSONExtractRaw(raw, 'properties') AS event_properties,
		JSONExtractRaw(raw, 'context') AS context,
		JSONExtractString(raw, 'routing', 'lane') AS route_lane,
		toUInt8(JSONExtractBool(raw, 'routing', 'skipEnrichment')) AS skip_enrichment,
		JSONExtractString(raw, 'routing', 'sourceOffset') AS source_offset,
		toInt32(JSONExtractInt(raw, 'routing', 'sourcePartition')) AS source_partition,
		JSONExtractString(raw, 'routing', 'sourceTopic') AS source_topic,
		JSONExtractString(raw, 'token') AS token,
		JSONExtractString(raw, 'request', 'path') AS request_path,
		JSONExtractString(raw, 'request', 'requestId') AS request_id,
		toUInt8(JSONExtractInt(raw, 'schemaVersion')) AS schema_version
	FROM event_processed_v2_kafka`,
  `CREATE TABLE IF NOT EXISTS event_person_v1_kafka
	(
		raw String
	)
	ENGINE = Kafka
	SETTINGS
		kafka_broker_list = '${KAFKA_BROKER_LIST}',
		kafka_topic_list = 'event.person.v1',
		kafka_group_name = 'clickhouse-event-person-v1',
		kafka_format = 'JSONAsString',
		kafka_num_consumers = 1`,
  `CREATE MATERIALIZED VIEW IF NOT EXISTS event_person_v1_mv
	TO ${CLICKHOUSE_PERSONS_TABLE}
	AS
	SELECT
		JSONExtractString(raw, 'personId') AS person_id,
		JSONExtractString(raw, 'projectId') AS project_id,
		nullIf(JSONExtractString(raw, 'primaryDistinctId'), '') AS primary_distinct_id,
		nullIf(JSONExtractString(raw, 'email'), '') AS email,
		nullIf(JSONExtractString(raw, 'name'), '') AS name,
		JSONExtractRaw(raw, 'traits') AS traits,
		toUInt8(JSONExtractBool(raw, 'isArchived')) AS is_archived,
		nullIf(JSONExtractString(raw, 'mergedIntoPersonId'), '') AS merged_into_person_id,
		toUInt64(JSONExtractInt(raw, 'version')) AS version,
		parseDateTime64BestEffort(JSONExtractString(raw, 'changedAt'), 3) AS changed_at
	FROM event_person_v1_kafka`,
  `CREATE TABLE IF NOT EXISTS event_person_identity_v1_kafka
	(
		raw String
	)
	ENGINE = Kafka
	SETTINGS
		kafka_broker_list = '${KAFKA_BROKER_LIST}',
		kafka_topic_list = 'event.person-distinct-id.v1',
		kafka_group_name = 'clickhouse-event-person-identity-v1',
		kafka_format = 'JSONAsString',
		kafka_num_consumers = 1`,
  `CREATE MATERIALIZED VIEW IF NOT EXISTS event_person_identity_v1_mv
	TO ${CLICKHOUSE_PERSON_IDENTITY_TABLE}
	AS
	SELECT
		JSONExtractString(raw, 'projectId') AS project_id,
		JSONExtractString(raw, 'distinctId') AS distinct_id,
		nullIf(JSONExtractString(raw, 'previousDistinctId'), '') AS previous_distinct_id,
		JSONExtractString(raw, 'personId') AS person_id,
		toUInt8(JSONExtractBool(raw, 'isDeleted')) AS is_deleted,
		toUInt64(JSONExtractInt(raw, 'version')) AS version,
		parseDateTime64BestEffort(JSONExtractString(raw, 'changedAt'), 3) AS changed_at
	FROM event_person_identity_v1_kafka`,
  `CREATE MATERIALIZED VIEW IF NOT EXISTS event_person_identity_overrides_v1_mv
	TO ${CLICKHOUSE_PERSON_IDENTITY_OVERRIDES_TABLE}
	AS
	SELECT
		JSONExtractString(raw, 'projectId') AS project_id,
		JSONExtractString(raw, 'distinctId') AS distinct_id,
		nullIf(JSONExtractString(raw, 'previousDistinctId'), '') AS previous_distinct_id,
		JSONExtractString(raw, 'personId') AS person_id,
		toUInt8(JSONExtractBool(raw, 'isDeleted')) AS is_deleted,
		toUInt64(JSONExtractInt(raw, 'version')) AS version,
		parseDateTime64BestEffort(JSONExtractString(raw, 'changedAt'), 3) AS changed_at
	FROM event_person_identity_v1_kafka
	WHERE
		toUInt64(JSONExtractInt(raw, 'version')) > 0
		AND nullIf(JSONExtractString(raw, 'previousDistinctId'), '') IS NOT NULL`,
] as const;

export default Effect.gen(function* () {
  const ch = yield* ClickhouseWebClient.ClickhouseWebClient;
  const sql = yield* SqlClient.SqlClient;

  for (const statement of migration0002Statements) {
    yield* ch.asCommand(sql`${sql.literal(statement)}`);
  }
});
