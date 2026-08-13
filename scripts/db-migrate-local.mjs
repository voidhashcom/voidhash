// Applies the drizzle-generated migrations under
// `packages/db/src/alchemy-migrations` to the local Docker Postgres.
//
// Alchemy applies these same files to the remote PlanetScale Postgres branch
// (alchemy/Planetscale/Postgres/PostgresMigrations). Local development talks to
// the `standalone_postgres` container instead, which Alchemy never touches, so
// this script reproduces the runner's apply logic 1:1:
//   - track applied files in an `__alchemy_migrations` table
//     (id TEXT, name TEXT, applied_at TIMESTAMPTZ),
//   - run each `migration.sql` as a single query — Postgres treats drizzle's
//     `--> statement-breakpoint` markers as inert `--` line comments, so no
//     statement splitting is needed (the Postgres runner does the same),
//   - run pending files in directory (timestamp) order, one transaction each.
//
// The migrations live in a non-standard, dir-per-migration layout
// (`<timestamp>_<name>/migration.sql`, no `meta/_journal.json`), so the stock
// `drizzle-kit migrate` command can't apply them — hence the custom runner.
//
// Usage:
//   pnpm db:migrate:local            # apply pending migrations
//   pnpm db:migrate:local --force    # allow a non-local DATABASE_HOST
//
// Connection is read from env with local-dev defaults:
//   DATABASE_HOST=127.0.0.1 DATABASE_PORT=5432 DATABASE_NAME=voidhash
//   DATABASE_USERNAME=voidhash DATABASE_PASSWORD=password
// Each `DATABASE_DIRECT_*` override wins over its `DATABASE_*` counterpart, for
// the same reason `getSelfhostMigrationDatabaseConfig` exists: when the app is
// pointed at a sandboxed or proxied endpoint (a connection broker, a
// Hyperdrive-style local socket), that hostname resolves only inside the
// runtime serving requests, while this script needs a real TCP socket.
// The Docker image (docker-compose.yml) creates `voidhash` as a superuser that
// owns the `voidhash` database, so the app user has full DDL locally.

import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Config, Console, Data, Effect, FileSystem, Path, Stdio } from "effect";
import { Client } from "pg";

const MIGRATIONS_DIR = "packages/db/src/alchemy-migrations";
const MIGRATIONS_TABLE = "__alchemy_migrations";

/**
 * Any failure that should print one line and exit non-zero, like the old
 * `throw new Error`. `silent` marks a failure whose guidance was already written
 * to stderr in full, so the top-level reporter must not print it a second time.
 */
class MigrateError extends Data.TaggedError("MigrateError") {}

/** Renders an unknown rejection/defect as a message, mirroring `error.message`. */
const messageOf = (cause) => {
  if (cause instanceof Error) return cause.message;
  return String(cause);
};

/** Wraps a thrown/rejected value as the script's single failure type. */
const toMigrateError = (cause) => new MigrateError({ message: messageOf(cause) });

// Hosts we consider safe to bootstrap + migrate without `--force` (mirrors the
// allowlist in packages/db/src/db.ts). Guards against pointing this at a remote
// or PlanetScale host by accident.
const LOCAL_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
  "host.docker.internal",
  "standalone_postgres",
]);

const isLocalHost = (host) => {
  const h = host.trim().toLowerCase();
  return LOCAL_HOSTS.has(h) || h.endsWith(".localhost");
};

/**
 * Reads `DATABASE_DIRECT_<name>`, falling back to `DATABASE_<name>` and then to
 * the local Docker default.
 *
 * @param {string} name
 * @param {string} fallback
 */
const direct = (name, fallback) =>
  Config.string(`DATABASE_DIRECT_${name}`).pipe(
    Config.orElse(() => Config.string(`DATABASE_${name}`)),
    Config.withDefault(fallback),
  );

/** Connection settings, read from env with the local Docker defaults. */
const readConfig = Effect.gen(function* () {
  const host = yield* direct("HOST", "127.0.0.1");
  const port = yield* direct("PORT", "5432");
  const database = yield* direct("NAME", "voidhash");
  const user = yield* direct("USERNAME", "voidhash");
  const password = yield* direct("PASSWORD", "password");
  const ssl = yield* direct("SSL", "false");
  return {
    host,
    port: Number.parseInt(port, 10),
    database,
    user,
    password,
    // `pg` treats any truthy value as "negotiate TLS", so an explicit `false`
    // has to become the boolean, not the string "false".
    ssl: ssl.trim().toLowerCase() === "true",
  };
}).pipe(Effect.mapError(toMigrateError));

/** Folder names carry a generation timestamp, so lexicographic order is apply order. */
const byName = (a, b) => {
  if (a.name < b.name) return -1;
  if (a.name > b.name) return 1;
  return 0;
};

/** Migration directories sorted by their timestamp-prefixed name. */
const collectMigrations = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  if (!(yield* fileSystem.exists(MIGRATIONS_DIR))) return [];

  const migrations = [];
  for (const entry of yield* fileSystem.readDirectory(MIGRATIONS_DIR)) {
    // A non-directory entry can never hold a `migration.sql`, so the file check
    // subsumes the old `isDirectory()` filter.
    const file = path.join(MIGRATIONS_DIR, entry, "migration.sql");
    if (!(yield* fileSystem.exists(file))) continue;
    migrations.push({ name: entry, file });
  }
  return migrations.sort(byName);
}).pipe(Effect.mapError(toMigrateError));

/** Runs one query on an open client, mapping a rejection to the script's failure type. */
const query = (client, sql, values) =>
  Effect.tryPromise({ try: () => client.query(sql, values), catch: toMigrateError });

/**
 * Opens a connection, hands it to `use`, and always closes it — the Effect
 * equivalent of the `try { … } finally { await conn.end() }` bracket.
 */
const withClient = (options, use) =>
  Effect.acquireUseRelease(
    Effect.gen(function* () {
      const client = new Client(options);
      yield* Effect.tryPromise({ try: () => client.connect(), catch: toMigrateError });
      return client;
    }),
    use,
    (client) => Effect.promise(() => client.end()),
  );

/**
 * Ensure the dev database exists. The Docker image normally creates it via
 * `POSTGRES_DB`, so this is a best-effort backstop. `CREATE DATABASE` cannot run
 * inside a transaction or against the target database itself, so we connect to
 * the always-present `postgres` maintenance database.
 */
const bootstrap = (config, dbIdent) =>
  withClient(
    {
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: "postgres",
      ssl: config.ssl,
    },
    (conn) =>
      Effect.gen(function* () {
        const exists = yield* query(conn, "SELECT 1 FROM pg_database WHERE datname = $1", [
          config.database,
        ]);
        if (exists.rowCount !== 0) return;
        yield* query(conn, `CREATE DATABASE ${dbIdent}`);
        yield* Console.log(`created database "${config.database}"`);
      }),
  );

/** Highest numeric migration id seen so far; non-numeric ids are ignored. */
const highestSeq = (max, { id }) => {
  const n = Number.parseInt(String(id), 10);
  if (Number.isNaN(n)) return max;
  return Math.max(max, n);
};

/** Applies one migration in its own transaction, rolling back on failure. */
const applyMigration = (conn, tableIdent, name, sql, migrationId) =>
  Effect.gen(function* () {
    yield* query(conn, "BEGIN");
    yield* query(conn, sql);
    yield* query(conn, `INSERT INTO ${tableIdent} (id, name) VALUES ($1, $2);`, [
      migrationId,
      name,
    ]);
    yield* query(conn, "COMMIT");
  }).pipe(
    Effect.catch((error) =>
      Effect.gen(function* () {
        yield* query(conn, "ROLLBACK").pipe(Effect.ignore);
        return yield* new MigrateError({
          message: `Failed to apply migration "${name}": ${error.message}`,
          cause: error,
        });
      }),
    ),
  );

/** Final one-line report, matching the previous wording exactly. */
const summary = (appliedCount) => {
  if (appliedCount === 0) return "db-migrate-local: database already up to date";
  return `db-migrate-local: applied ${appliedCount} migration(s)`;
};

const migrate = (config, tableIdent) =>
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const migrations = yield* collectMigrations;
    if (migrations.length === 0) {
      return yield* Console.log(`db-migrate-local: no migrations found in ${MIGRATIONS_DIR}`);
    }

    return yield* withClient(
      {
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
        ssl: config.ssl,
      },
      (conn) =>
        Effect.gen(function* () {
          yield* query(
            conn,
            `CREATE TABLE IF NOT EXISTS ${tableIdent} (
         id TEXT PRIMARY KEY,
         name TEXT NOT NULL,
         applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
       );`,
          );

          const appliedRows = yield* query(conn, `SELECT name FROM ${tableIdent};`);
          const applied = new Set(appliedRows.rows.map((row) => row.name));

          const idRows = yield* query(conn, `SELECT id FROM ${tableIdent};`);
          let nextSeq = idRows.rows.reduce(highestSeq, 0) + 1;

          let appliedCount = 0;
          for (const { name, file } of migrations) {
            if (applied.has(name)) continue;

            const sql = yield* fileSystem.readFileString(file).pipe(Effect.mapError(toMigrateError));
            const migrationId = String(nextSeq).padStart(5, "0");
            nextSeq += 1;

            yield* applyMigration(conn, tableIdent, name, sql, migrationId);
            appliedCount += 1;
            yield* Console.log(`applied: ${name}`);
          }

          yield* Console.log(summary(appliedCount));
        }),
    );
  });

const program = Effect.gen(function* () {
  const stdio = yield* Stdio.Stdio;
  const args = yield* stdio.args;

  const config = yield* readConfig;
  const force = args.includes("--force");

  if (!isLocalHost(config.host) && !force) {
    yield* Console.error(
      `Refusing to migrate non-local host "${config.host}". This script is for ` +
        `the local Docker Postgres only; remote branches are migrated by Alchemy. ` +
        `Pass --force to override.`,
    );
    return yield* new MigrateError({ message: `non-local host "${config.host}"`, silent: true });
  }

  // `config.database` / `MIGRATIONS_TABLE` are interpolated as SQL identifiers
  // (which can't be parameterized). Both are fixed local defaults, not external
  // input, so this is safe.
  const dbIdent = `"${config.database.replaceAll('"', '""')}"`;
  const tableIdent = `"${MIGRATIONS_TABLE}"`;

  // `postgres` is the maintenance database and always exists, so there is
  // nothing to create. Skipping is also what makes `pnpm db:pglite` work:
  // PGlite serves exactly one database, named `postgres`, and accepts a
  // `CREATE DATABASE` that silently produces an unreachable entry.
  if (config.database !== "postgres") yield* bootstrap(config, dbIdent);
  yield* migrate(config, tableIdent);
});

/** Prints the failure exactly like the old top-level catch, then exits non-zero. */
const reportFailure = (error) =>
  Effect.gen(function* () {
    if (!error.silent) yield* Console.error(`db-migrate-local: ${error.message}`);
    return yield* Effect.fail(error);
  });

// Error reporting stays off so a failure prints only the single line above, and
// `runMain` still exits non-zero on the tagged failure.
NodeRuntime.runMain(
  program.pipe(Effect.catch(reportFailure), Effect.provide(NodeServices.layer)),
  { disableErrorReporting: true },
);
