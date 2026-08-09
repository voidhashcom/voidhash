import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { constant } from "@voidhash/lib/lang";

import {
  CLICKHOUSE_EVENTS_TABLE,
  CLICKHOUSE_PERSON_IDENTITY_OVERRIDES_TABLE,
  CLICKHOUSE_PERSON_IDENTITY_PENDING_OVERRIDES_V2_TABLE,
  CLICKHOUSE_PERSON_IDENTITY_TABLE,
  CLICKHOUSE_PERSONS_TABLE,
} from "../analytics/schema.ts";
import { ClickhouseWebClient } from "../clickhouse-client-web/index.ts";

const IDENTITY_TABLES = constant([
  CLICKHOUSE_PERSONS_TABLE,
  CLICKHOUSE_PERSON_IDENTITY_TABLE,
  CLICKHOUSE_PERSON_IDENTITY_OVERRIDES_TABLE,
  CLICKHOUSE_PERSON_IDENTITY_PENDING_OVERRIDES_V2_TABLE,
]);

const ORG_BACKFILL_JOIN = "person_org_backfill_join_0008";

/** Build the idempotent `organization_id` column repair for an identity table. */
export const buildAddOrganizationIdStatement = (table: string): string =>
  `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS organization_id String DEFAULT '' AFTER project_id`;

/** Build the transient project-to-organization join table used by the backfill. */
export const buildCreateOrgBackfillJoinStatement = (joinTable: string): string =>
  `CREATE TABLE ${joinTable}
       (project_id String, organization_id String)
       ENGINE = Join(ANY, LEFT, project_id)`;

/** Build the statement that loads the transient organization lookup from events. */
export const buildPopulateOrgBackfillJoinStatement = (joinTable: string): string =>
  `INSERT INTO ${joinTable}
       SELECT project_id, any(source_organization_id) AS organization_id
       FROM (
         SELECT project_id, organization_id AS source_organization_id
         FROM ${CLICKHOUSE_EVENTS_TABLE}
         WHERE organization_id != ''
       )
       GROUP BY project_id`;

/** Build the mutation that fills missing organization ids for one identity table. */
export const buildBackfillOrganizationIdStatement = (table: string, joinTable: string): string =>
  `ALTER TABLE ${table}
         UPDATE organization_id = joinGet('${joinTable}', 'organization_id', project_id)
         WHERE organization_id = ''
           AND joinGet('${joinTable}', 'organization_id', project_id) != ''
         SETTINGS mutations_sync = 1`;

const execute = (statement: string) =>
  Effect.gen(function* () {
    const ch = yield* ClickhouseWebClient.ClickhouseWebClient;
    const sql = yield* SqlClient.SqlClient;
    yield* ch.asCommand(sql`${sql.literal(statement)}`);
  });

export default Effect.gen(function* repairIdentityOrganizationId() {
  for (const table of IDENTITY_TABLES) {
    yield* execute(buildAddOrganizationIdStatement(table));
  }

  yield* execute(`DROP TABLE IF EXISTS ${ORG_BACKFILL_JOIN}`);
  yield* execute(buildCreateOrgBackfillJoinStatement(ORG_BACKFILL_JOIN));
  yield* execute(buildPopulateOrgBackfillJoinStatement(ORG_BACKFILL_JOIN));

  for (const table of IDENTITY_TABLES) {
    yield* execute(buildBackfillOrganizationIdStatement(table, ORG_BACKFILL_JOIN));
  }

  yield* execute(`DROP TABLE IF EXISTS ${ORG_BACKFILL_JOIN}`);
});
