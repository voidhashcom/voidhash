import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { Effect, Schema } from "effect";
import { Client } from "pg";

import type { DbConfig } from "./db.ts";

const migrationsTable = "__alchemy_migrations";
const defaultMigrationsDirectory = new URL("./alchemy-migrations/", import.meta.url);

/** Stable failure raised while discovering or applying application migrations. */
export class AppDatabaseMigrationError extends Schema.TaggedErrorClass<AppDatabaseMigrationError>(
  "AppDatabaseMigrationError",
)("AppDatabaseMigrationError", {
  cause: Schema.String,
  migrationName: Schema.optional(Schema.String),
  operation: Schema.String,
}) {}

/** Migration-runner overrides used by tests and alternate package layouts. */
export interface AppDatabaseMigrationOptions {
  readonly directory?: URL;
  readonly lockName?: string;
}

/** Summary of one application migration run. */
export interface AppDatabaseMigrationResult {
  readonly applied: ReadonlyArray<string>;
  readonly skipped: number;
}

interface MigrationFile {
  readonly name: string;
  readonly sql: string;
}

const collectMigrations = async (directory: URL): Promise<ReadonlyArray<MigrationFile>> => {
  const entries = await readdir(fileURLToPath(directory), { withFileTypes: true });
  const migrations: MigrationFile[] = [];

  for (const entry of entries.filter((candidate) => candidate.isDirectory()).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const migrationUrl = new URL(`${entry.name}/migration.sql`, directory);
    try {
      migrations.push({
        name: entry.name,
        sql: await readFile(migrationUrl, "utf8"),
      });
    } catch (cause) {
      const code =
        typeof cause === "object" && cause !== null && "code" in cause
          ? cause.code
          : undefined;
      if (code !== "ENOENT") throw cause;
    }
  }

  return migrations;
};

const runMigrations = async (
  config: DbConfig,
  options: AppDatabaseMigrationOptions,
): Promise<AppDatabaseMigrationResult> => {
  const client = new Client({
    database: config.databaseName,
    host: config.host,
    password: config.password,
    port: config.port,
    ssl: config.ssl,
    user: config.username,
  });
  const migrations = await collectMigrations(options.directory ?? defaultMigrationsDirectory);
  const lockName = options.lockName ?? `${config.databaseName}:voidhash-app-migrations`;
  let currentMigration: string | undefined;

  await client.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtext($1))", [lockName]);
    try {
      await client.query(
        `CREATE TABLE IF NOT EXISTS ${migrationsTable} (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`,
      );
      const appliedRows = await client.query<{ readonly id: string; readonly name: string }>(
        `SELECT id, name FROM ${migrationsTable}`,
      );
      const appliedNames = new Set(appliedRows.rows.map(({ name }) => name));
      let nextSequence =
        appliedRows.rows.reduce((maximum, { id }) => {
          const value = Number.parseInt(id, 10);
          return Number.isNaN(value) ? maximum : Math.max(maximum, value);
        }, 0) + 1;
      const applied: string[] = [];

      for (const migration of migrations) {
        if (appliedNames.has(migration.name)) continue;
        currentMigration = migration.name;
        await client.query("BEGIN");
        try {
          await client.query(migration.sql);
          await client.query(
            `INSERT INTO ${migrationsTable} (id, name) VALUES ($1, $2)`,
            [String(nextSequence).padStart(5, "0"), migration.name],
          );
          await client.query("COMMIT");
        } catch (cause) {
          await client.query("ROLLBACK").catch(() => undefined);
          throw cause;
        }
        nextSequence += 1;
        applied.push(migration.name);
        currentMigration = undefined;
      }

      return { applied, skipped: migrations.length - applied.length };
    } finally {
      await client
        .query("SELECT pg_advisory_unlock(hashtext($1))", [lockName])
        .catch(() => undefined);
    }
  } catch (cause) {
    throw new AppDatabaseMigrationError({
      cause: String(cause),
      migrationName: currentMigration,
      operation: currentMigration ? "apply" : "initialize",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
};

/** Applies pending application migrations from the package's canonical migration directory. */
export const runAppDatabaseMigrations = (
  config: DbConfig,
  options: AppDatabaseMigrationOptions = {},
): Effect.Effect<AppDatabaseMigrationResult, AppDatabaseMigrationError> =>
  Effect.tryPromise({
    try: () => runMigrations(config, options),
    catch: (cause) =>
      cause instanceof AppDatabaseMigrationError
        ? cause
        : new AppDatabaseMigrationError({
            cause: String(cause),
            operation: "discover",
          }),
  });
