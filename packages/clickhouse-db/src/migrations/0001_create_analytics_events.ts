import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { CLICKHOUSE_EVENTS_TABLE } from "../analytics/schema.ts";
import { ClickhouseWebClient } from "../clickhouse-client-web/index.ts";

export default Effect.gen(function* () {
  const ch = yield* ClickhouseWebClient.ClickhouseWebClient;
  const sql = yield* SqlClient.SqlClient;

  yield* ch.asCommand(sql`
    CREATE TABLE IF NOT EXISTS ${sql(CLICKHOUSE_EVENTS_TABLE)}
    (
      event_id          String,
      event_name        String,

      event_ts          DateTime64(3),
      ingestion_ts      DateTime64(3),

      organization_id   String,
      project_id        String,

      distinct_id       String,
      session_id        Nullable(String),

      source            LowCardinality(String),

      properties        Map(String, String),
      context           Map(String, String),

      schema_version    UInt8
    )
    ENGINE = MergeTree
    PARTITION BY toYYYYMM(event_ts)
    ORDER BY (organization_id, project_id, event_name, event_ts, event_id)
  `);
});
