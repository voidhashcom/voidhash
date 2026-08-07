import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { constant } from "@voidhash/lib/lang";

import {
  CLICKHOUSE_PERSON_IDENTITY_OVERRIDES_TABLE,
  CLICKHOUSE_PERSON_IDENTITY_PENDING_OVERRIDES_V2_TABLE,
  CLICKHOUSE_PERSON_IDENTITY_TABLE,
} from "../analytics/schema.ts";
import { ClickhouseWebClient } from "../clickhouse-client-web/index.ts";

const KAFKA_BROKER_LIST = "redpanda:9092";

const statements = constant([
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
  `CREATE TABLE IF NOT EXISTS ${CLICKHOUSE_PERSON_IDENTITY_PENDING_OVERRIDES_V2_TABLE}
	(
		project_id String,
		source_distinct_id String,
		target_distinct_id String,
		person_id String,
		is_deleted UInt8,
		version UInt64,
		changed_at DateTime64(3)
	)
	ENGINE = ReplacingMergeTree(version)
	PARTITION BY toYYYYMM(changed_at)
	ORDER BY (project_id, source_distinct_id)`,
  `CREATE MATERIALIZED VIEW IF NOT EXISTS event_person_identity_pending_overrides_v2_mv
	TO ${CLICKHOUSE_PERSON_IDENTITY_PENDING_OVERRIDES_V2_TABLE}
	AS
	SELECT
		JSONExtractString(raw, 'projectId') AS project_id,
		JSONExtractString(raw, 'previousDistinctId') AS source_distinct_id,
		JSONExtractString(raw, 'distinctId') AS target_distinct_id,
		JSONExtractString(raw, 'personId') AS person_id,
		toUInt8(JSONExtractBool(raw, 'isDeleted')) AS is_deleted,
		toUInt64(JSONExtractInt(raw, 'version')) AS version,
		parseDateTime64BestEffort(JSONExtractString(raw, 'changedAt'), 3) AS changed_at
	FROM event_person_identity_v1_kafka
	WHERE
		toUInt64(JSONExtractInt(raw, 'version')) > 0
		AND nullIf(JSONExtractString(raw, 'previousDistinctId'), '') IS NOT NULL`,
  `INSERT INTO ${CLICKHOUSE_PERSON_IDENTITY_PENDING_OVERRIDES_V2_TABLE}
	(
		project_id,
		source_distinct_id,
		target_distinct_id,
		person_id,
		is_deleted,
		version,
		changed_at
	)
	SELECT
		project_id,
		previous_distinct_id AS source_distinct_id,
		distinct_id AS target_distinct_id,
		person_id,
		is_deleted,
		version,
		changed_at
	FROM ${CLICKHOUSE_PERSON_IDENTITY_OVERRIDES_TABLE}`,
]);

export default Effect.gen(function* () {
  const ch = yield* ClickhouseWebClient.ClickhouseWebClient;
  const sql = yield* SqlClient.SqlClient;

  for (const statement of statements) {
    yield* ch.asCommand(sql`${sql.literal(statement)}`);
  }
});
