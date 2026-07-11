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
// The Docker image (docker-compose.yml) creates `voidhash` as a superuser that
// owns the `voidhash` database, so the app user has full DDL locally.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

const MIGRATIONS_DIR = "packages/db/src/alchemy-migrations";
const MIGRATIONS_TABLE = "__alchemy_migrations";

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

const config = {
  host: process.env.DATABASE_HOST ?? "127.0.0.1",
  port: Number.parseInt(process.env.DATABASE_PORT ?? "5432", 10),
  database: process.env.DATABASE_NAME ?? "voidhash",
  user: process.env.DATABASE_USERNAME ?? "voidhash",
  password: process.env.DATABASE_PASSWORD ?? "password",
};

const force = process.argv.includes("--force");

if (!isLocalHost(config.host) && !force) {
  console.error(
    `Refusing to migrate non-local host "${config.host}". This script is for ` +
      `the local Docker Postgres only; remote branches are migrated by Alchemy. ` +
      `Pass --force to override.`,
  );
  process.exit(1);
}

// `config.database` / `MIGRATIONS_TABLE` are interpolated as SQL identifiers
// (which can't be parameterized). Both are fixed local defaults, not external
// input, so this is safe.
const dbIdent = `"${config.database.replaceAll('"', '""')}"`;
const tableIdent = `"${MIGRATIONS_TABLE}"`;

/** Migration directories sorted by their timestamp-prefixed name. */
const collectMigrations = () => {
  if (!existsSync(MIGRATIONS_DIR)) return [];
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((name) => ({ name, file: join(MIGRATIONS_DIR, name, "migration.sql") }))
    .filter((m) => existsSync(m.file));
};

/**
 * Ensure the dev database exists. The Docker image normally creates it via
 * `POSTGRES_DB`, so this is a best-effort backstop. `CREATE DATABASE` cannot run
 * inside a transaction or against the target database itself, so we connect to
 * the always-present `postgres` maintenance database.
 */
const bootstrap = async () => {
  const conn = new Client({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: "postgres",
  });
  await conn.connect();
  try {
    const exists = await conn.query("SELECT 1 FROM pg_database WHERE datname = $1", [
      config.database,
    ]);
    if (exists.rowCount === 0) {
      await conn.query(`CREATE DATABASE ${dbIdent}`);
      console.log(`created database "${config.database}"`);
    }
  } finally {
    await conn.end();
  }
};

const migrate = async () => {
  const migrations = collectMigrations();
  if (migrations.length === 0) {
    console.log(`db-migrate-local: no migrations found in ${MIGRATIONS_DIR}`);
    return;
  }

  const conn = new Client({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
  });
  await conn.connect();

  try {
    await conn.query(
      `CREATE TABLE IF NOT EXISTS ${tableIdent} (
         id TEXT PRIMARY KEY,
         name TEXT NOT NULL,
         applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
       );`,
    );

    const appliedRows = await conn.query(`SELECT name FROM ${tableIdent};`);
    const applied = new Set(appliedRows.rows.map((row) => row.name));

    const idRows = await conn.query(`SELECT id FROM ${tableIdent};`);
    let nextSeq =
      idRows.rows.reduce((max, { id }) => {
        const n = Number.parseInt(String(id), 10);
        return Number.isNaN(n) ? max : Math.max(max, n);
      }, 0) + 1;

    let appliedCount = 0;
    for (const { name, file } of migrations) {
      if (applied.has(name)) continue;

      const sql = readFileSync(file, "utf8");
      const migrationId = String(nextSeq).padStart(5, "0");
      nextSeq += 1;

      await conn.query("BEGIN");
      try {
        await conn.query(sql);
        await conn.query(`INSERT INTO ${tableIdent} (id, name) VALUES ($1, $2);`, [
          migrationId,
          name,
        ]);
        await conn.query("COMMIT");
      } catch (error) {
        await conn.query("ROLLBACK").catch(() => {});
        throw new Error(`Failed to apply migration "${name}": ${error.message}`, {
          cause: error,
        });
      }
      appliedCount += 1;
      console.log(`applied: ${name}`);
    }

    console.log(
      appliedCount === 0
        ? "db-migrate-local: database already up to date"
        : `db-migrate-local: applied ${appliedCount} migration(s)`,
    );
  } finally {
    await conn.end();
  }
};

try {
  await bootstrap();
  await migrate();
} catch (error) {
  console.error(`db-migrate-local: ${error.message}`);
  process.exit(1);
}
