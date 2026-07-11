import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

import {
  CLICKHOUSE_EVENTS_TABLE,
  CLICKHOUSE_PERSON_IDENTITY_PENDING_OVERRIDES_V2_TABLE,
  CLICKHOUSE_PERSONS_TABLE,
} from "../analytics/schema.ts";
import { ClickhouseWebClient } from "../clickhouse-client-web/index.ts";

interface DescribeColumnRow {
  name: string;
}

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

const addColumnFromLegacy = ({
  columns,
  fallbackType,
  legacyExpression,
  name,
  table,
}: {
  columns: ReadonlySet<string>;
  fallbackType: string;
  legacyExpression?: string;
  name: string;
  table: string;
}) => {
  if (columns.has(name)) {
    return Effect.void;
  }

  const expression = legacyExpression ? ` DEFAULT ${legacyExpression}` : "";
  return execute(
    `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${name} ${fallbackType}${expression}`,
  );
};

export default Effect.gen(function* alignAnalyticsIdentityTables() {
  const eventColumns = yield* getColumnNames(CLICKHOUSE_EVENTS_TABLE);
  if (!eventColumns.has("previous_distinct_id")) {
    yield* execute(
      `ALTER TABLE ${CLICKHOUSE_EVENTS_TABLE} ADD COLUMN IF NOT EXISTS previous_distinct_id Nullable(String) AFTER distinct_id`,
    );
  }

  const personColumns = yield* getColumnNames(CLICKHOUSE_PERSONS_TABLE);
  yield* addColumnFromLegacy({
    columns: personColumns,
    fallbackType: "String",
    legacyExpression: personColumns.has("customer_id") ? "customer_id" : undefined,
    name: "person_id",
    table: CLICKHOUSE_PERSONS_TABLE,
  });
  yield* addColumnFromLegacy({
    columns: personColumns,
    fallbackType: "Nullable(String)",
    legacyExpression: personColumns.has("app_user_id") ? "nullIf(app_user_id, '')" : undefined,
    name: "primary_distinct_id",
    table: CLICKHOUSE_PERSONS_TABLE,
  });
  yield* addColumnFromLegacy({
    columns: personColumns,
    fallbackType: "String",
    legacyExpression: personColumns.has("properties") ? "properties" : undefined,
    name: "traits",
    table: CLICKHOUSE_PERSONS_TABLE,
  });
  yield* addColumnFromLegacy({
    columns: personColumns,
    fallbackType: "Nullable(String)",
    legacyExpression: personColumns.has("parent_customer_id") ? "parent_customer_id" : undefined,
    name: "merged_into_person_id",
    table: CLICKHOUSE_PERSONS_TABLE,
  });

  const pendingOverrideColumns = yield* getColumnNames(
    CLICKHOUSE_PERSON_IDENTITY_PENDING_OVERRIDES_V2_TABLE,
  );
  yield* addColumnFromLegacy({
    columns: pendingOverrideColumns,
    fallbackType: "String",
    legacyExpression: pendingOverrideColumns.has("customer_id") ? "customer_id" : undefined,
    name: "person_id",
    table: CLICKHOUSE_PERSON_IDENTITY_PENDING_OVERRIDES_V2_TABLE,
  });
});
