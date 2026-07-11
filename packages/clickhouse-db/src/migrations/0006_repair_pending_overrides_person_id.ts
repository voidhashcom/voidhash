import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { CLICKHOUSE_PERSON_IDENTITY_PENDING_OVERRIDES_V2_TABLE } from "../analytics/schema.ts";
import { ClickhouseWebClient } from "../clickhouse-client-web/index.ts";

interface DescribeColumnRow {
  name: string;
}

export const buildAddPendingOverridePersonIdStatement = (table: string): string =>
  `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS person_id String DEFAULT customer_id AFTER customer_id`;

const getColumnNames = (table: string) =>
  Effect.gen(function* getColumnNamesEffect() {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql<DescribeColumnRow>`
      DESCRIBE TABLE ${sql.literal(table)}
    `;

    return new Set(rows.map((row) => row.name));
  });

const execute = (statement: string) =>
  Effect.gen(function* executeEffect() {
    const ch = yield* ClickhouseWebClient.ClickhouseWebClient;
    const sql = yield* SqlClient.SqlClient;
    yield* ch.asCommand(sql`${sql.literal(statement)}`);
  });

export default Effect.gen(function* repairPendingOverridesPersonId() {
  const columns = yield* getColumnNames(CLICKHOUSE_PERSON_IDENTITY_PENDING_OVERRIDES_V2_TABLE);

  if (columns.has("person_id") || !columns.has("customer_id")) {
    return;
  }

  yield* execute(
    buildAddPendingOverridePersonIdStatement(CLICKHOUSE_PERSON_IDENTITY_PENDING_OVERRIDES_V2_TABLE),
  );
});
