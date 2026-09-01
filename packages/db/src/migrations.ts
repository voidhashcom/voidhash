import { NodeServices } from "@effect/platform-node";

import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashSet from "effect/HashSet";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import * as Str from "effect/String";
import { Client } from "pg";
import type { QueryResult, QueryResultRow } from "pg";

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

const query = <Row extends QueryResultRow = QueryResultRow>(
  client: Client,
  sql: string,
  values?: ReadonlyArray<unknown>,
): Effect.Effect<QueryResult<Row>, unknown> =>
  Effect.tryPromise({
    try: () => client.query<Row>(sql, values?.slice()),
    catch: (cause) => cause,
  });

const collectMigrations = (
  directory: URL,
): Effect.Effect<ReadonlyArray<MigrationFile>, unknown, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const root = yield* path.fromFileUrl(directory);
    const entries = yield* fs.readDirectory(root);
    const migrations = yield* Effect.forEach(
      Arr.sort(entries, Str.Order),
      Effect.fn("collectMigration")(function* (entry) {
        const entryPath = path.join(root, entry);
        const info = yield* fs.stat(entryPath);
        if (info.type !== "Directory") return Option.none<MigrationFile>();

        const migrationPath = path.join(entryPath, "migration.sql");
        const exists = yield* fs.exists(migrationPath);
        if (!exists) return Option.none<MigrationFile>();

        return Option.some({ name: entry, sql: yield* fs.readFileString(migrationPath) });
      }),
      { concurrency: 1 },
    );
    return Arr.getSomes(migrations);
  });

const nextSequenceFrom = (rows: ReadonlyArray<{ readonly id: string }>): number =>
  rows.reduce((maximum, { id }) => {
    const value = Number.parseInt(id, 10);
    if (Number.isNaN(value)) return maximum;
    return Math.max(maximum, value);
  }, 0) + 1;

const applyMigration = (
  client: Client,
  migration: MigrationFile,
  sequence: number,
): Effect.Effect<void, unknown> =>
  Effect.gen(function* () {
    yield* query(client, "BEGIN");
    yield* Effect.gen(function* () {
      yield* query(client, migration.sql);
      yield* query(client, `INSERT INTO ${migrationsTable} (id, name) VALUES ($1, $2)`, [
        String(sequence).padStart(5, "0"),
        migration.name,
      ]);
      yield* query(client, "COMMIT");
    }).pipe(Effect.tapError(() => Effect.ignore(query(client, "ROLLBACK"))));
  });

const applyPending = (
  client: Client,
  migrations: ReadonlyArray<MigrationFile>,
): Effect.Effect<AppDatabaseMigrationResult, AppDatabaseMigrationError> =>
  Effect.gen(function* () {
    yield* query(
      client,
      `CREATE TABLE IF NOT EXISTS ${migrationsTable} (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`,
    );
    const appliedRows = yield* query<{ readonly id: string; readonly name: string }>(
      client,
      `SELECT id, name FROM ${migrationsTable}`,
    );
    const appliedNames = HashSet.fromIterable(appliedRows.rows.map(({ name }) => name));
    const pending = migrations.filter((migration) => !HashSet.has(appliedNames, migration.name));
    const nextSequence = nextSequenceFrom(appliedRows.rows);
    yield* Effect.forEach(
      pending,
      (migration, index) =>
        applyMigration(client, migration, nextSequence + index).pipe(
          Effect.mapError(
            (cause) =>
              new AppDatabaseMigrationError({
                cause: String(cause),
                migrationName: migration.name,
                operation: "apply",
              }),
          ),
        ),
      { concurrency: 1 },
    );
    const applied = pending.map((migration) => migration.name);

    return { applied, skipped: migrations.length - applied.length };
  }).pipe(
    Effect.catch((cause: unknown) => {
      if (cause instanceof AppDatabaseMigrationError) return Effect.fail(cause);
      return Effect.fail(
        new AppDatabaseMigrationError({ cause: String(cause), operation: "initialize" }),
      );
    }),
  );

const runMigrations = (
  config: DbConfig,
  options: AppDatabaseMigrationOptions,
): Effect.Effect<
  AppDatabaseMigrationResult,
  AppDatabaseMigrationError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const client = new Client({
      database: config.databaseName,
      host: config.host,
      password: config.password,
      port: config.port,
      ssl: config.ssl,
      user: config.username,
    });
    const migrations = yield* collectMigrations(
      options.directory ?? defaultMigrationsDirectory,
    ).pipe(
      Effect.mapError(
        (cause) => new AppDatabaseMigrationError({ cause: String(cause), operation: "discover" }),
      ),
    );
    const lockName = options.lockName ?? `${config.databaseName}:voidhash-app-migrations`;

    yield* Effect.tryPromise({
      try: () => client.connect(),
      catch: (cause) =>
        new AppDatabaseMigrationError({ cause: String(cause), operation: "discover" }),
    });

    return yield* Effect.acquireUseRelease(
      query(client, "SELECT pg_advisory_lock(hashtext($1))", [lockName]).pipe(
        Effect.mapError(
          (cause) =>
            new AppDatabaseMigrationError({ cause: String(cause), operation: "initialize" }),
        ),
      ),
      () => applyPending(client, migrations),
      () => Effect.ignore(query(client, "SELECT pg_advisory_unlock(hashtext($1))", [lockName])),
    ).pipe(Effect.ensuring(Effect.ignore(Effect.tryPromise(() => client.end()))));
  });

/**
 * Applies pending application migrations from the package's canonical migration
 * directory.
 *
 * The migration runner is Node-only (it opens its own `pg` connection), so the
 * Node filesystem services are provided here and callers stay dependency-free.
 */
export const runAppDatabaseMigrations = (
  config: DbConfig,
  options: AppDatabaseMigrationOptions = {},
): Effect.Effect<AppDatabaseMigrationResult, AppDatabaseMigrationError> =>
  runMigrations(config, options).pipe(Effect.provide(NodeServices.layer));
