import { Effect, Layer } from "effect";
import { SqlClient, type SqlError } from "effect/unstable/sql";

import { ClickhouseWebClient } from "./clickhouse-client-web/index.ts";

export type ClickhouseDbConfig = {
  readonly database?: string;
  readonly url: string;
  readonly username?: string;
  readonly password?: string;
};

export type Migration = readonly [
  id: number,
  name: string,
  effect: Effect.Effect<
    void,
    SqlError.SqlError,
    SqlClient.SqlClient | ClickhouseWebClient.ClickhouseWebClient
  >,
];

export type MigrationSet = {
  readonly tableName: string;
  readonly migrations: ReadonlyArray<Migration>;
};

/**
 * Reads the highest applied migration id from the ledger query result, or `-1`
 * when the ledger is empty (or the row does not carry a numeric id).
 */
const latestMigrationId = (rows: ReadonlyArray<unknown>): number => {
  const row = rows[0];
  if (typeof row === "object" && row !== null && "migration_id" in row) {
    const id = row.migration_id;
    if (typeof id === "number") {
      return id;
    }
  }
  return -1;
};

const runMigrationSet = (migrationSet: MigrationSet) =>
  Layer.effectDiscard(
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const ch = yield* ClickhouseWebClient.ClickhouseWebClient;

      yield* ch.asCommand(sql`
        CREATE TABLE IF NOT EXISTS ${sql(migrationSet.tableName)}
        (
          migration_id Int32,
          created_at DateTime DEFAULT now(),
          name String
        )
        ENGINE = MergeTree
        ORDER BY migration_id
      `);

      const applied = yield* sql`
        SELECT migration_id FROM ${sql(migrationSet.tableName)} ORDER BY migration_id DESC LIMIT 1
      `.withoutTransform;
      const latestId = latestMigrationId(applied);

      for (const [id, name, migration] of migrationSet.migrations) {
        if (id <= latestId) continue;
        yield* migration;
        yield* ch.asCommand(sql`
          INSERT INTO ${sql(migrationSet.tableName)} (migration_id, name)
          VALUES (${id}, ${name})
        `);
      }
    }),
  );

/** Builds a scoped ClickHouse client and applies the requested migration sets. */
export const ClickhouseDbLive = (
  { database, url, username, password }: ClickhouseDbConfig,
  migrationSets: ReadonlyArray<MigrationSet> = [],
) => {
  const clientLayer = ClickhouseWebClient.layer({
    database,
    password,
    url,
    username,
  });

  if (migrationSets.length === 0) {
    return clientLayer;
  }

  const migrationLayers = migrationSets.map(runMigrationSet);
  const allMigrations = migrationLayers.reduce((acc, layer) => acc.pipe(Layer.merge(layer)));

  return allMigrations.pipe(Layer.provideMerge(clientLayer));
};
