import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

import {
  CLICKHOUSE_EVENTS_TABLE,
  CLICKHOUSE_PERSON_IDENTITY_OVERRIDES_TABLE,
  CLICKHOUSE_PERSON_IDENTITY_PENDING_OVERRIDES_V2_TABLE,
  CLICKHOUSE_PERSON_IDENTITY_TABLE,
  CLICKHOUSE_PERSONS_TABLE,
} from "../analytics/schema.ts";
import { ClickhouseWebClient } from "../clickhouse-client-web/index.ts";

/**
 * Person/identity tables that are keyed by `project_id` and gain an
 * `organization_id` so the readonly analytics user's per-tenant row policies
 * can isolate them (events_v2 already carries `organization_id`).
 */
const IDENTITY_TABLES = [
  CLICKHOUSE_PERSONS_TABLE,
  CLICKHOUSE_PERSON_IDENTITY_TABLE,
  CLICKHOUSE_PERSON_IDENTITY_OVERRIDES_TABLE,
  CLICKHOUSE_PERSON_IDENTITY_PENDING_OVERRIDES_V2_TABLE,
] as const;

/** Transient `project_id -> organization_id` lookup used only during backfill. */
const ORG_BACKFILL_JOIN = "person_org_backfill_join_0007" as const;

const execute = (statement: string) =>
  Effect.gen(function* () {
    const ch = yield* ClickhouseWebClient.ClickhouseWebClient;
    const sql = yield* SqlClient.SqlClient;
    yield* ch.asCommand(sql`${sql.literal(statement)}`);
  });

/**
 * Adds `organization_id` to the four person/identity tables and backfills it
 * from the authoritative `project_id -> organization_id` mapping carried by
 * `events_v2`. New rows are stamped by the writer (it resolves the org from
 * MySQL); this migration covers rows that predate the writer change.
 *
 * Idempotent: the `WHERE organization_id = ''` guard means a re-run after a
 * crash only touches still-unset rows, and the `ADD COLUMN IF NOT EXISTS` /
 * `DROP TABLE IF EXISTS` statements converge. Mutations run with
 * `mutations_sync = 1` so the migration waits for each rewrite to finish.
 *
 * Known limitation: a project with person/identity rows but zero `events_v2`
 * rows has no entry in the join and keeps `organization_id = ''` (invisible to
 * the readonly user) until a new event for it lands.
 */
export default Effect.gen(function* () {
  for (const table of IDENTITY_TABLES) {
    yield* execute(
      `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS organization_id String DEFAULT '' AFTER project_id`,
    );
  }

  yield* execute(`DROP TABLE IF EXISTS ${ORG_BACKFILL_JOIN}`);
  yield* execute(
    `CREATE TABLE ${ORG_BACKFILL_JOIN}
       (project_id String, organization_id String)
       ENGINE = Join(ANY, LEFT, project_id)`,
  );
  yield* execute(
    `INSERT INTO ${ORG_BACKFILL_JOIN}
       SELECT project_id, any(source_organization_id) AS organization_id
       FROM (
         SELECT project_id, organization_id AS source_organization_id
         FROM ${CLICKHOUSE_EVENTS_TABLE}
         WHERE organization_id != ''
       )
       GROUP BY project_id`,
  );

  for (const table of IDENTITY_TABLES) {
    yield* execute(
      `ALTER TABLE ${table}
         UPDATE organization_id = joinGet('${ORG_BACKFILL_JOIN}', 'organization_id', project_id)
         WHERE organization_id = ''
           AND joinGet('${ORG_BACKFILL_JOIN}', 'organization_id', project_id) != ''
         SETTINGS mutations_sync = 1`,
    );
  }

  yield* execute(`DROP TABLE IF EXISTS ${ORG_BACKFILL_JOIN}`);
});
