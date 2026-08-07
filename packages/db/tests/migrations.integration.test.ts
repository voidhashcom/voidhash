import { Config, Effect, Random } from "effect";
import { Client } from "pg";
import type { ClientConfig, QueryResult, QueryResultRow } from "pg";
import { describe, expect, it } from "vitest";

import type { DbConfig } from "../src/db.ts";
import { runAppDatabaseMigrations } from "../src/migrations.ts";

const loadAdminConfig = Effect.gen(function* () {
  const host = yield* Config.string("DATABASE_HOST").pipe(
    Config.withDefault("127.0.0.1"),
    Effect.orDie,
  );
  const password = yield* Config.string("DATABASE_PASSWORD").pipe(
    Config.withDefault("password"),
    Effect.orDie,
  );
  const port = yield* Config.int("DATABASE_PORT").pipe(Config.withDefault(5432), Effect.orDie);
  const user = yield* Config.string("DATABASE_USERNAME").pipe(
    Config.withDefault("voidhash"),
    Effect.orDie,
  );
  return { database: "postgres", host, password, port, user };
});

/** Per-run database name; only needs to be collision-free within the suite. */
const makeDatabaseName = Effect.gen(function* () {
  const suffix = yield* Random.nextIntBetween(0, Number.MAX_SAFE_INTEGER);
  return `voidhash_migrations_${suffix.toString(36).padStart(12, "0").slice(0, 12)}`;
});

const query = <Row extends QueryResultRow = QueryResultRow>(
  client: Client,
  sql: string,
  values?: ReadonlyArray<unknown>,
): Effect.Effect<QueryResult<Row>> => Effect.promise(() => client.query<Row>(sql, values?.slice()));

const withClient = <A, E, R>(
  clientConfig: ClientConfig,
  use: (client: Client) => Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  Effect.acquireUseRelease(
    Effect.gen(function* () {
      const client = new Client(clientConfig);
      yield* Effect.promise(() => client.connect());
      return client;
    }),
    use,
    (client) => Effect.ignore(Effect.promise(() => client.end())),
  );

describe("application database migrations", () => {
  it("serializes concurrent runners and records an idempotent later run", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const adminConfig = yield* loadAdminConfig;
        const databaseName = yield* makeDatabaseName;
        const config: DbConfig = {
          databaseName,
          host: adminConfig.host,
          password: adminConfig.password,
          port: adminConfig.port,
          username: adminConfig.user,
        };

        yield* withClient(adminConfig, (client) =>
          query(client, `CREATE DATABASE "${databaseName}"`),
        );

        const dropDatabase = withClient(adminConfig, (client) =>
          Effect.gen(function* () {
            yield* query(
              client,
              "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1",
              [databaseName],
            );
            yield* query(client, `DROP DATABASE IF EXISTS "${databaseName}"`);
          }),
        );

        yield* Effect.gen(function* () {
          const concurrent = yield* Effect.all(
            [runAppDatabaseMigrations(config), runAppDatabaseMigrations(config)],
            { concurrency: "unbounded" },
          );
          const applied = concurrent.flatMap((result) => result.applied);
          const later = yield* runAppDatabaseMigrations(config);

          expect(applied.length).toBeGreaterThan(0);
          expect(new Set(applied).size).toBe(applied.length);
          expect(concurrent.some((result) => result.applied.length === 0)).toBe(true);
          expect(later.applied).toEqual([]);
          expect(later.skipped).toBe(applied.length);

          yield* withClient({ ...adminConfig, database: databaseName }, (client) =>
            Effect.gen(function* () {
              const tracker = yield* query<{ readonly count: string }>(
                client,
                "SELECT count(*)::text AS count FROM __alchemy_migrations",
              );
              const tables = yield* query<{ readonly organization: string | null }>(
                client,
                "SELECT to_regclass('public.organization')::text AS organization",
              );
              expect(Number(tracker.rows[0]?.count)).toBe(applied.length);
              expect(tables.rows[0]?.organization).toBe("organization");
            }),
          );
        }).pipe(Effect.ensuring(Effect.orDie(dropDatabase)));
      }),
    ));
});
