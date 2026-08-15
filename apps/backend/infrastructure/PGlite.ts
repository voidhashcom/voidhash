import * as Command from "alchemy/Command";
import type * as Cloudflare from "alchemy/Cloudflare";
import * as Output from "alchemy/Output";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";

const HOST = "127.0.0.1";
const PORT = 5432;
const DATABASE = "postgres";
const USERNAME = "postgres";
const PASSWORD = "postgres";

const migrationsMemo = {
  include: ["scripts/db-migrate-local.mjs", "packages/db/src/alchemy-migrations/**/migration.sql"],
  lockfile: true,
};

/**
 * Runs the persistent Community development database and applies migrations
 * before exposing its connection settings to dependent resources.
 */
export const PGliteDatabase = Effect.gen(function* () {
  const server = yield* Command.Dev("PGliteDatabase", {
    command: "node scripts/pglite-dev-server.mjs",
    env: {
      PGLITE_DATA_DIR: ".pglite/dev",
      PGLITE_HOST: HOST,
      PGLITE_PORT: String(PORT),
    },
  });

  // The readiness token gives the migration resource an explicit graph edge
  // from the long-lived server, while memoization reruns it for new SQL files.
  const migrations = yield* Command.Exec("PGliteMigrations", {
    command: "node scripts/db-migrate-local.mjs",
    env: {
      DATABASE_HOST: HOST,
      DATABASE_PORT: String(PORT),
      DATABASE_NAME: DATABASE,
      DATABASE_USERNAME: USERNAME,
      DATABASE_PASSWORD: PASSWORD,
      DATABASE_SSL: "false",
      PGLITE_SERVER_READY: Output.map(server.url, (url) => url ?? ""),
    },
    memo: migrationsMemo,
  });

  // Hyperdrive must resolve only after the migration command has succeeded.
  return Output.map(
    migrations.hash.input,
    () =>
      ({
        scheme: "postgres",
        host: HOST,
        port: PORT,
        database: DATABASE,
        user: USERNAME,
        password: Redacted.make(PASSWORD),
        sslmode: "disable",
      }) satisfies Cloudflare.Hyperdrive.DevOrigin,
  );
});

const PostgresDatabase = Effect.gen(function* () {
  const host = yield* Config.string("DATABASE_HOST").pipe(Config.withDefault("127.0.0.1"));
  const port = yield* Config.port("DATABASE_PORT").pipe(Config.withDefault(5432));
  const database = yield* Config.string("DATABASE_NAME").pipe(Config.withDefault("voidhash"));
  const user = yield* Config.string("DATABASE_USERNAME").pipe(Config.withDefault("voidhash"));
  const password = yield* Config.redacted("DATABASE_PASSWORD").pipe(
    Config.withDefault(Redacted.make("password")),
  );
  const ssl = yield* Config.boolean("DATABASE_SSL").pipe(Config.withDefault(false));

  const migrations = yield* Command.Exec("PostgresMigrations", {
    command: "node scripts/db-migrate-local.mjs --force",
    env: {
      DATABASE_HOST: host,
      DATABASE_PORT: String(port),
      DATABASE_NAME: database,
      DATABASE_USERNAME: user,
      DATABASE_PASSWORD: password,
      DATABASE_SSL: String(ssl),
    },
    memo: migrationsMemo,
  });

  let sslmode: Cloudflare.Hyperdrive.DevOrigin["sslmode"] = "disable";
  if (ssl) sslmode = "require";

  return Output.map(
    migrations.hash.input,
    () =>
      ({
        scheme: "postgres",
        host,
        port,
        database,
        user,
        password,
        sslmode,
      }) satisfies Cloudflare.Hyperdrive.DevOrigin,
  );
});

/**
 * Selects and migrates the Community development database. PGlite is the
 * default; `DATABASE_MODE=pg` uses the configured PostgreSQL origin instead.
 */
export const DevelopmentDatabase = Effect.gen(function* () {
  const mode = yield* Config.literals(["pglite", "pg"], "DATABASE_MODE").pipe(
    Config.withDefault("pglite"),
  );
  if (mode === "pg") return yield* PostgresDatabase;
  return yield* PGliteDatabase;
}).pipe(Effect.orDie);
