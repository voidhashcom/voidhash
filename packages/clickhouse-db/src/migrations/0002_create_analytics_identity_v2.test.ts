import { describe, expect, it } from "vite-plus/test";

import { migration0002Statements } from "./0002_create_analytics_identity_v2.ts";

describe("migration0002Statements", () => {
  it("rebuilds processed-event ingestion objects before recreating the materialized view", () => {
    const dropViewIndex = migration0002Statements.indexOf(
      "DROP TABLE IF EXISTS event_processed_v2_mv",
    );
    const dropKafkaIndex = migration0002Statements.indexOf(
      "DROP TABLE IF EXISTS event_processed_v2_kafka",
    );
    const dropEventsIndex = migration0002Statements.indexOf("DROP TABLE IF EXISTS events_v2");
    const createEventsIndex = migration0002Statements.findIndex((statement) =>
      statement.includes("CREATE TABLE events_v2"),
    );
    const createKafkaIndex = migration0002Statements.findIndex((statement) =>
      statement.includes("CREATE TABLE IF NOT EXISTS event_processed_v2_kafka"),
    );
    const createViewIndex = migration0002Statements.findIndex((statement) =>
      statement.includes("CREATE MATERIALIZED VIEW IF NOT EXISTS event_processed_v2_mv"),
    );

    expect(dropViewIndex).toBeGreaterThanOrEqual(0);
    expect(dropKafkaIndex).toBe(dropViewIndex + 1);
    expect(dropEventsIndex).toBe(dropKafkaIndex + 1);
    expect(createEventsIndex).toBe(dropEventsIndex + 1);
    expect(createKafkaIndex).toBeGreaterThan(createEventsIndex);
    expect(createViewIndex).toBeGreaterThan(createKafkaIndex);
  });

  it("defines events_v2 with the processed-event columns expected by the materialized view", () => {
    const createEventsTable = migration0002Statements.find((statement) =>
      statement.includes("CREATE TABLE events_v2"),
    );

    expect(createEventsTable).toBeDefined();
    expect(createEventsTable).toContain("event_id String");
    expect(createEventsTable).toContain("capture_id String");
    expect(createEventsTable).toContain("event_name String");
    expect(createEventsTable).toContain("event_ts DateTime64(3)");
    expect(createEventsTable).toContain("processed_ts DateTime64(3)");
    expect(createEventsTable).toContain("organization_id String");
    expect(createEventsTable).toContain("project_id String");
    expect(createEventsTable).toContain("distinct_id String");
    expect(createEventsTable).toContain("previous_distinct_id Nullable(String)");
    expect(createEventsTable).toContain("person_id Nullable(String)");
    expect(createEventsTable).toContain("identity_mode LowCardinality(String)");
    expect(createEventsTable).toContain("event_properties String");
    expect(createEventsTable).toContain("context String");
    expect(createEventsTable).toContain("route_lane LowCardinality(String)");
    expect(createEventsTable).toContain("skip_enrichment UInt8");
    expect(createEventsTable).toContain("source_offset String");
    expect(createEventsTable).toContain("source_partition Int32");
    expect(createEventsTable).toContain("source_topic String");
    expect(createEventsTable).toContain("token String");
    expect(createEventsTable).toContain("request_path LowCardinality(String)");
    expect(createEventsTable).toContain("request_id String");
    expect(createEventsTable).toContain("schema_version UInt8");
  });

  it("keeps the materialized view aliases aligned with the rebuilt events_v2 schema", () => {
    const createMaterializedView = migration0002Statements.find((statement) =>
      statement.includes("CREATE MATERIALIZED VIEW IF NOT EXISTS event_processed_v2_mv"),
    );

    expect(createMaterializedView).toBeDefined();
    expect(createMaterializedView).toContain(
      "JSONExtractString(raw, 'processedEventId') AS event_id",
    );
    expect(createMaterializedView).toContain("JSONExtractString(raw, 'captureId') AS capture_id");
    expect(createMaterializedView).toContain("JSONExtractString(raw, 'event') AS event_name");
    expect(createMaterializedView).toContain(
      "parseDateTime64BestEffort(JSONExtractString(raw, 'processedAt'), 3) AS processed_ts",
    );
    expect(createMaterializedView).toContain(
      "nullIf(JSONExtractString(raw, 'previousDistinctId'), '') AS previous_distinct_id",
    );
    expect(createMaterializedView).toContain(
      "nullIf(JSONExtractString(raw, 'identity', 'personId'), '') AS person_id",
    );
    expect(createMaterializedView).toContain(
      "JSONExtractString(raw, 'identity', 'mode') AS identity_mode",
    );
    expect(createMaterializedView).toContain(
      "JSONExtractRaw(raw, 'properties') AS event_properties",
    );
    expect(createMaterializedView).toContain(
      "JSONExtractString(raw, 'routing', 'lane') AS route_lane",
    );
    expect(createMaterializedView).toContain(
      "toUInt8(JSONExtractBool(raw, 'routing', 'skipEnrichment')) AS skip_enrichment",
    );
    expect(createMaterializedView).toContain(
      "JSONExtractString(raw, 'routing', 'sourceOffset') AS source_offset",
    );
    expect(createMaterializedView).toContain(
      "toInt32(JSONExtractInt(raw, 'routing', 'sourcePartition')) AS source_partition",
    );
    expect(createMaterializedView).toContain(
      "JSONExtractString(raw, 'routing', 'sourceTopic') AS source_topic",
    );
    expect(createMaterializedView).toContain("JSONExtractString(raw, 'token') AS token");
    expect(createMaterializedView).toContain(
      "JSONExtractString(raw, 'request', 'path') AS request_path",
    );
    expect(createMaterializedView).toContain(
      "JSONExtractString(raw, 'request', 'requestId') AS request_id",
    );
    expect(createMaterializedView).toContain(
      "toUInt8(JSONExtractInt(raw, 'schemaVersion')) AS schema_version",
    );
  });
});
