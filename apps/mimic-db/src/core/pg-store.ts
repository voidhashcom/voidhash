import * as PgClient from "@effect/sql-pg/PgClient";
import { validateValue, type Command, type Value } from "@voidhash/mimic-core";
import { Effect, Predicate, Redacted, Schema } from "effect";
import { SqlClient, SqlError } from "effect/unstable/sql";

import type { CommandRow, DocumentMeta, DocumentStoreApi, SnapshotRow } from "./store.ts";

/** Resolved Postgres connection parameters for the document store. */
export interface PgDocumentConfig {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly username: string;
  readonly password: Redacted.Redacted<string>;
}

/** Plain connection input accepted at package boundaries before secret redaction. */
export interface PgDocumentConfigInput extends Omit<PgDocumentConfig, "password"> {
  readonly password: string;
}

/**
 * Builds document-store configuration while redacting the password in the same
 * Effect module instance that later consumes it.
 */
export const makePgDocumentConfig = (config: PgDocumentConfigInput): PgDocumentConfig => ({
  ...config,
  password: Redacted.make(config.password),
});

const clientLayer = (config: PgDocumentConfig) =>
  PgClient.layer({
    host: config.host,
    port: config.port,
    database: config.database,
    username: config.username,
    password: config.password,
  });

// `@effect/sql-pg` runs statements through node-postgres's prepared path.

const JsonText = Schema.fromJsonString(Schema.Any);
const parseJsonText = Schema.decodeUnknownSync(JsonText);
const formatJsonText = Schema.encodeSync(JsonText);
const acceptAny = Schema.decodeUnknownSync(Schema.Any);

/**
 * Reads a `jsonb` column. node-postgres hands back either an already-parsed
 * object or the raw JSON text depending on the driver's type parsers, so both
 * shapes are normalised here through the same JSON codec.
 */
const decodeJsonColumn = <A>(input: unknown): A => {
  if (Predicate.isString(input)) return parseJsonText(input);
  return acceptAny(input);
};

/** Renders a value as the JSON text bound to a `jsonb` parameter. */
const encodeJsonColumn = (value: unknown): string => formatJsonText(value);

const decodeValue = (input: unknown): Value => {
  const decoded = decodeJsonColumn<Value>(input);
  validateValue(decoded);
  return decoded;
};

const decodeCommand = (input: unknown): Command => decodeJsonColumn<Command>(input);

interface MetaSqlRow {
  readonly collectionId: string;
  readonly schemaVersion: number;
  readonly migrationVersion: number | null;
  readonly currentSeq: number | string;
  readonly snapshotSeq: number | string;
  readonly deletedAt: number | string | null;
}
const nullableNumber = (value: number | string | null): number | null => {
  if (value === null) return null;
  return Number(value);
};

interface SnapshotSqlRow {
  readonly seq: number | string;
  readonly schemaVersion: number;
  readonly stateJson: unknown;
}
interface CommandSqlRow {
  readonly seq: number | string;
  readonly commandJson: unknown;
  readonly txId: string;
}

/** Postgres SQLSTATE for `undefined_table`. */
const UNDEFINED_TABLE = "42P01";
/** Postgres SQLSTATE for `undefined_column`. */
const UNDEFINED_COLUMN = "42703";
/** Postgres SQLSTATE for `insufficient_privilege`. */
const INSUFFICIENT_PRIVILEGE = "42501";

const sqlErrorCauseProperty = (error: SqlError.SqlError, property: string): unknown => {
  if (!Predicate.hasProperty(error.reason.cause, property)) return undefined;
  return error.reason.cause[property];
};

/** Whether a `SqlError` is Postgres's `undefined_table` — the queried table is missing. */
export const isMissingTableError = (error: SqlError.SqlError): boolean =>
  sqlErrorCauseProperty(error, "code") === UNDEFINED_TABLE;

const isMissingColumnError = (error: SqlError.SqlError): boolean =>
  sqlErrorCauseProperty(error, "code") === UNDEFINED_COLUMN;

/**
 * Whether a `SqlError` is Postgres denying DDL to the connected role (SQLSTATE
 * 42501, `insufficient_privilege`). A PlanetScale Postgres role that inherits
 * `postgres` may run DDL, so on a correctly-provisioned database the runtime
 * CREATE path succeeds; this classifies the failure for a least-privilege role
 * so a missing table dies with an actionable error instead of an opaque
 * `SqlError`. The mimic document tables otherwise come from the deploy-time
 * migration pipeline (the `mimic_document_tables` migration in
 * `packages/db/src/alchemy-migrations`, which mirrors this DDL).
 */
export const isDdlDeniedError = (error: SqlError.SqlError): boolean =>
  sqlErrorCauseProperty(error, "code") === INSUFFICIENT_PRIVILEGE;

/**
 * Ensure the mimic document tables exist when a persistent document adapter
 * boots. No foreign keys to the control plane: databases and collections may
 * live in a different entity store, while durable document state lives here.
 *
 * Each table is probed first and only created when missing, so the steady
 * state runs no DDL. The runtime `CREATE TABLE` path bootstraps local/dev
 * Postgres and PlanetScale Postgres roles that inherit `postgres`; where a
 * least-privilege role denies DDL the tables come from the deploy-time
 * migration pipeline (the `mimic_document_tables` migration in
 * `packages/db/src/alchemy-migrations`, which mirrors this DDL) — a denied
 * CREATE for a missing table dies with an actionable error instead of an
 * opaque `SqlError`.
 */
export const ensureDocumentTables = (config: PgDocumentConfig): Effect.Effect<void> =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    const ensure = (
      table: string,
      probe: Effect.Effect<unknown, SqlError.SqlError>,
      create: Effect.Effect<unknown, SqlError.SqlError>,
    ): Effect.Effect<void, SqlError.SqlError> =>
      probe.pipe(
        Effect.asVoid,
        Effect.catch((error) => {
          if (!isMissingTableError(error)) return Effect.fail(error);
          return create.pipe(
            Effect.asVoid,
            Effect.catch((createError) => {
              if (!isDdlDeniedError(createError)) return Effect.fail(createError);
              return Effect.die(
                new Error(
                  `mimic document table "${table}" does not exist and the database denies runtime DDL ` +
                    `(the connected Postgres role cannot CREATE TABLE). Apply the ` +
                    `mimic_document_tables migration in packages/db/src/alchemy-migrations before serving traffic.`,
                ),
              );
            }),
          );
        }),
      );

    yield* ensure(
      "mimic_documents",
      sql`SELECT 1 FROM mimic_documents LIMIT 1`,
      sql`
        CREATE TABLE IF NOT EXISTS mimic_documents (
          id VARCHAR(36) NOT NULL PRIMARY KEY,
          collection_id VARCHAR(36) NOT NULL,
          schema_version INTEGER NOT NULL DEFAULT 1,
          migration_version INTEGER,
          current_seq BIGINT NOT NULL DEFAULT 0,
          snapshot_seq BIGINT NOT NULL DEFAULT 0,
          deleted_at BIGINT
        )
      `,
    );
    yield* sql`SELECT migration_version FROM mimic_documents LIMIT 1`.pipe(
      Effect.asVoid,
      Effect.catch((error) => {
        if (!isMissingColumnError(error)) return Effect.fail(error);
        return sql`ALTER TABLE mimic_documents ADD COLUMN migration_version INTEGER`.pipe(
          Effect.asVoid,
          Effect.catch((alterError) => {
            if (!isDdlDeniedError(alterError)) return Effect.fail(alterError);
            return Effect.die(
              new Error(
                "mimic_documents.migration_version is missing and the database denies runtime DDL. Apply the current database migrations before serving traffic.",
              ),
            );
          }),
        );
      }),
    );
    yield* ensure(
      "mimic_document_snapshots",
      sql`SELECT 1 FROM mimic_document_snapshots LIMIT 1`,
      sql`
        CREATE TABLE IF NOT EXISTS mimic_document_snapshots (
          document_id VARCHAR(36) NOT NULL,
          seq BIGINT NOT NULL,
          schema_version INTEGER NOT NULL DEFAULT 1,
          state_json JSONB NOT NULL,
          PRIMARY KEY (document_id, seq)
        )
      `,
    );
    yield* ensure(
      "mimic_document_commands",
      sql`SELECT 1 FROM mimic_document_commands LIMIT 1`,
      sql`
        CREATE TABLE IF NOT EXISTS mimic_document_commands (
          document_id VARCHAR(36) NOT NULL,
          seq BIGINT NOT NULL,
          command_json JSONB NOT NULL,
          tx_id VARCHAR(255) NOT NULL,
          PRIMARY KEY (document_id, seq)
        )
      `,
    );
  }).pipe(
    Effect.provide(clientLayer(config)),
    Effect.scoped,
    // Log the structured SQL failure before `orDie` turns it into a defect.
    Effect.tapError((error) => Effect.logError("mimic-db: ensuring document tables failed", error)),
    Effect.orDie,
  );

/**
 * Postgres-backed `DocumentStore` for one document. The entity host owns
 * per-document concurrency and realtime coordination; snapshots and the command
 * log remain durable in Postgres.
 *
 * The returned methods have `R = never` so they slot into the same
 * `DocumentEngine` as the in-memory backend.
 */
export const makePgDocumentStore = (
  config: PgDocumentConfig,
  documentId: string,
): DocumentStoreApi => {
  const layer = clientLayer(config);
  const run = <A, E>(effect: Effect.Effect<A, E, SqlClient.SqlClient>): Effect.Effect<A> =>
    effect.pipe(
      Effect.provide(layer),
      Effect.scoped,
      // Log the structured SQL failure before `orDie` turns it into a defect.
      Effect.tapError((error) =>
        Effect.logError("mimic-db: Postgres document-store operation failed", error),
      ),
      Effect.orDie,
    );

  return {
    readMeta: () =>
      run(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const rows = yield* sql<MetaSqlRow>`
            SELECT collection_id AS "collectionId", schema_version AS "schemaVersion",
                   migration_version AS "migrationVersion",
                   current_seq AS "currentSeq", snapshot_seq AS "snapshotSeq", deleted_at AS "deletedAt"
            FROM mimic_documents WHERE id = ${documentId}
          `;
          const row = rows[0];
          if (!row) return undefined;
          return {
            collectionId: row.collectionId,
            schemaVersion: row.schemaVersion,
            migrationVersion: row.migrationVersion,
            currentSeq: Number(row.currentSeq),
            snapshotSeq: Number(row.snapshotSeq),
            deletedAt: nullableNumber(row.deletedAt),
          } satisfies DocumentMeta;
        }),
      ),

    initialize: (collectionId, value, schemaVersion, migrationVersion) =>
      run(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          yield* sql`DELETE FROM mimic_document_commands WHERE document_id = ${documentId}`;
          yield* sql`DELETE FROM mimic_document_snapshots WHERE document_id = ${documentId}`;
          yield* sql`DELETE FROM mimic_documents WHERE id = ${documentId}`;
          yield* sql`
            INSERT INTO mimic_documents (id, collection_id, schema_version, migration_version, current_seq, snapshot_seq, deleted_at)
            VALUES (${documentId}, ${collectionId}, ${schemaVersion}, ${migrationVersion}, 0, 0, NULL)
          `;
          yield* sql`
            INSERT INTO mimic_document_snapshots (document_id, seq, schema_version, state_json)
            VALUES (${documentId}, 0, ${schemaVersion}, ${encodeJsonColumn(value)}::jsonb)
          `;
        }),
      ),

    loadLatestSnapshot: () =>
      run(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const rows = yield* sql<SnapshotSqlRow>`
            SELECT seq, schema_version AS "schemaVersion", state_json AS "stateJson"
            FROM mimic_document_snapshots WHERE document_id = ${documentId}
            ORDER BY seq DESC LIMIT 1
          `;
          const row = rows[0];
          if (!row) return undefined;
          return {
            seq: Number(row.seq),
            value: decodeValue(row.stateJson),
            schemaVersion: row.schemaVersion,
          } satisfies SnapshotRow;
        }),
      ),

    listCommandsAfter: (seq) =>
      run(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const rows = yield* sql<CommandSqlRow>`
            SELECT seq, command_json AS "commandJson", tx_id AS "txId"
            FROM mimic_document_commands WHERE document_id = ${documentId} AND seq > ${seq}
            ORDER BY seq ASC
          `;
          return rows.map(
            (row) =>
              ({
                seq: Number(row.seq),
                command: decodeCommand(row.commandJson),
                txId: row.txId,
              }) satisfies CommandRow,
          );
        }),
      ),

    appendCommands: (fromSeq, commands: readonly Command[], txId) =>
      run(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          yield* Effect.forEach(
            commands,
            (command, index) =>
              sql`
                INSERT INTO mimic_document_commands (document_id, seq, command_json, tx_id)
                VALUES (${documentId}, ${fromSeq + 1 + index}, ${encodeJsonColumn(command)}::jsonb, ${txId})
              `,
            { discard: true },
          );
        }),
      ),

    writeSnapshot: (seq, value, schemaVersion) =>
      run(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          // Upsert: migrate-on-load rewrites the snapshot at the current seq
          // (e.g. seq 0) with the migrated value + new schema version.
          yield* sql`
            INSERT INTO mimic_document_snapshots (document_id, seq, schema_version, state_json)
            VALUES (${documentId}, ${seq}, ${schemaVersion}, ${encodeJsonColumn(value)}::jsonb)
            ON CONFLICT (document_id, seq)
            DO UPDATE SET state_json = EXCLUDED.state_json, schema_version = EXCLUDED.schema_version
          `;
        }),
      ),

    commitMigration: (seq, value, schemaVersion, migrationVersion) =>
      run(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          yield* sql.withTransaction(
            Effect.gen(function* () {
              yield* sql`
                INSERT INTO mimic_document_snapshots (document_id, seq, schema_version, state_json)
                VALUES (${documentId}, ${seq}, ${schemaVersion}, ${encodeJsonColumn(value)}::jsonb)
                ON CONFLICT (document_id, seq)
                DO UPDATE SET state_json = EXCLUDED.state_json, schema_version = EXCLUDED.schema_version
              `;
              yield* sql`
                UPDATE mimic_documents
                SET schema_version = ${schemaVersion}, migration_version = ${migrationVersion}, snapshot_seq = ${seq}
                WHERE id = ${documentId}
              `;
            }),
          );
        }),
      ),

    setMeta: (patch) =>
      run(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          if (patch.currentSeq !== undefined) {
            yield* sql`UPDATE mimic_documents SET current_seq = ${patch.currentSeq} WHERE id = ${documentId}`;
          }
          if (patch.snapshotSeq !== undefined) {
            yield* sql`UPDATE mimic_documents SET snapshot_seq = ${patch.snapshotSeq} WHERE id = ${documentId}`;
          }
          if (patch.schemaVersion !== undefined) {
            yield* sql`UPDATE mimic_documents SET schema_version = ${patch.schemaVersion} WHERE id = ${documentId}`;
          }
          if (patch.deletedAt !== undefined) {
            yield* sql`UPDATE mimic_documents SET deleted_at = ${patch.deletedAt} WHERE id = ${documentId}`;
          }
        }),
      ),
  };
};
