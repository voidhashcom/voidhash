import type { SchemaObject } from "@voidhash/mimic-core";
import type {
  CollectionRecord,
  ControlStoreApi,
  DatabaseRecord,
  DocumentIndexRecord,
  GrantRecord,
  SchemaVersionRecord,
  TokenRecord,
  UserRecord,
} from "../core/store.ts";
import { pick } from "@voidhash/lib/lang";
import { DatabasePermissionSchema, DocumentPermissionSchema } from "@voidhash/mimic-server/rpc";
import type * as Cloudflare from "alchemy/Cloudflare";
import { RuntimeContext } from "alchemy/RuntimeContext";
import { Effect, Schema } from "effect";

/**
 * JSON codec for the `schema_json` text columns. A `SchemaObject` is mimic-core's
 * recursive, dynamically-shaped schema document, so it round-trips as an
 * unvalidated pass-through — this store only ever reads back JSON it wrote.
 */
const SchemaObjectFromJson = Schema.fromJsonString(
  Schema.declare((_value: unknown): _value is SchemaObject => true),
);
const decodeSchemaObject = Schema.decodeSync(SchemaObjectFromJson);
const encodeSchemaObject = Schema.encodeSync(SchemaObjectFromJson);

/** JSON codec for the token `origins_json` text column. */
const OriginsFromJson = Schema.fromJsonString(Schema.Array(Schema.String));
const decodeOrigins = Schema.decodeSync(OriginsFromJson);
const encodeOrigins = Schema.encodeSync(OriginsFromJson);

const decodeDatabasePermission = Schema.decodeUnknownSync(DatabasePermissionSchema);
const decodeDocumentPermission = Schema.decodeUnknownSync(DocumentPermissionSchema);

type Sql = Cloudflare.SqlStorage;

const CONTROL_INIT_SQL = `
CREATE TABLE IF NOT EXISTS databases (
  id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY, database_id TEXT NOT NULL, name TEXT NOT NULL,
  schema_json TEXT NOT NULL, schema_version INTEGER NOT NULL,
  migration_version INTEGER,
  UNIQUE (database_id, name)
);
CREATE TABLE IF NOT EXISTS schema_versions (
  collection_id TEXT NOT NULL, version INTEGER NOT NULL,
  schema_json TEXT NOT NULL, data_migration_source TEXT,
  PRIMARY KEY (collection_id, version)
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL, is_superuser INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS grants (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, database_id TEXT NOT NULL,
  permission TEXT NOT NULL, UNIQUE (user_id, database_id)
);
CREATE TABLE IF NOT EXISTS tokens (
  id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, collection_id TEXT NOT NULL,
  document_id TEXT NOT NULL, permission TEXT NOT NULL, origins_json TEXT NOT NULL,
  expires_at_ms INTEGER NOT NULL, used_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_tokens_hash ON tokens (token_hash);
CREATE TABLE IF NOT EXISTS document_index (
  document_id TEXT PRIMARY KEY, collection_id TEXT NOT NULL, deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_document_index_collection ON document_index (collection_id);
`;

interface DatabaseRow extends Record<string, Cloudflare.SqlStorageValue> {
  id: string;
  name: string;
  description: string;
}
interface CollectionRow extends Record<string, Cloudflare.SqlStorageValue> {
  id: string;
  database_id: string;
  name: string;
  schema_json: string;
  schema_version: number;
  migration_version: number | null;
}
interface SchemaVersionRow extends Record<string, Cloudflare.SqlStorageValue> {
  collection_id: string;
  version: number;
  schema_json: string;
  data_migration_source: string | null;
}
interface UserRow extends Record<string, Cloudflare.SqlStorageValue> {
  id: string;
  username: string;
  password_hash: string;
  is_superuser: number;
}
interface GrantRow extends Record<string, Cloudflare.SqlStorageValue> {
  id: string;
  user_id: string;
  database_id: string;
  permission: string;
}
interface TokenRow extends Record<string, Cloudflare.SqlStorageValue> {
  id: string;
  token_hash: string;
  collection_id: string;
  document_id: string;
  permission: string;
  origins_json: string;
  expires_at_ms: number;
  used_at: number | null;
}
interface DocumentIndexRow extends Record<string, Cloudflare.SqlStorageValue> {
  document_id: string;
  collection_id: string;
  deleted_at: number | null;
}
const toDatabase = (row: DatabaseRow): DatabaseRecord => ({
  id: row.id,
  name: row.name,
  description: row.description,
});
const toCollection = (row: CollectionRow): CollectionRecord => ({
  id: row.id,
  databaseId: row.database_id,
  name: row.name,
  schemaJson: decodeSchemaObject(row.schema_json),
  schemaVersion: row.schema_version,
  migrationVersion: row.migration_version,
});
const toSchemaVersion = (row: SchemaVersionRow): SchemaVersionRecord => ({
  collectionId: row.collection_id,
  version: row.version,
  schemaJson: decodeSchemaObject(row.schema_json),
  dataMigrationSource: row.data_migration_source,
});
const toUser = (row: UserRow): UserRecord => ({
  id: row.id,
  username: row.username,
  passwordHash: row.password_hash,
  isSuperuser: row.is_superuser === 1,
});
const toGrant = (row: GrantRow): GrantRecord => ({
  id: row.id,
  userId: row.user_id,
  databaseId: row.database_id,
  permission: decodeDatabasePermission(row.permission),
});
const toToken = (row: TokenRow): TokenRecord => ({
  id: row.id,
  tokenHash: row.token_hash,
  collectionId: row.collection_id,
  documentId: row.document_id,
  permission: decodeDocumentPermission(row.permission),
  origins: decodeOrigins(row.origins_json),
  expiresAtMs: row.expires_at_ms,
  usedAt: row.used_at,
});
const toDocumentIndex = (row: DocumentIndexRow): DocumentIndexRecord => ({
  documentId: row.document_id,
  collectionId: row.collection_id,
  deletedAt: row.deleted_at,
});
const first = <T>(rows: readonly T[]): T | undefined => rows[0];

/** SQLite-backed `ControlStore`, run inside `MimicHostObject`. */
export const makeSqlControlStore = (
  sql: Sql,
): Effect.Effect<ControlStoreApi, never, RuntimeContext> =>
  Effect.gen(function* () {
    const runtimeContext = yield* RuntimeContext;
    const run = <A>(effect: Effect.Effect<A, never, RuntimeContext>): Effect.Effect<A> =>
      effect.pipe(Effect.provideService(RuntimeContext, runtimeContext));
    const execute = <T extends Record<string, Cloudflare.SqlStorageValue>>(
      query: string,
      ...args: any[]
    ) => run(sql.exec<T>(query, ...args));
    const query = <T extends Record<string, Cloudflare.SqlStorageValue>>(
      query: string,
      ...args: any[]
    ) => run(Effect.flatMap(sql.exec<T>(query, ...args), (cursor) => cursor.toArray()));

    yield* execute(CONTROL_INIT_SQL);
    const collectionColumns = yield* query<{ name: string }>(`PRAGMA table_info(collections)`);
    if (!collectionColumns.some((column) => column.name === "migration_version")) {
      yield* execute(`ALTER TABLE collections ADD COLUMN migration_version INTEGER`);
    }

    return {
      createDatabase: (record) =>
        execute(
          `INSERT INTO databases (id, name, description) VALUES (?, ?, ?)`,
          record.id,
          record.name,
          record.description,
        ).pipe(Effect.asVoid),
      findDatabaseById: (id) =>
        query<DatabaseRow>(`SELECT * FROM databases WHERE id = ?`, id).pipe(
          Effect.map((rows) => first(rows.map(toDatabase))),
        ),
      findDatabaseByName: (name) =>
        query<DatabaseRow>(`SELECT * FROM databases WHERE name = ?`, name).pipe(
          Effect.map((rows) => first(rows.map(toDatabase))),
        ),
      listDatabases: () =>
        query<DatabaseRow>(`SELECT * FROM databases`).pipe(
          Effect.map((rows) => rows.map(toDatabase)),
        ),
      deleteDatabase: (id) => execute(`DELETE FROM databases WHERE id = ?`, id).pipe(Effect.asVoid),

      createCollection: (record) =>
        execute(
          `INSERT INTO collections (id, database_id, name, schema_json, schema_version, migration_version) VALUES (?, ?, ?, ?, ?, ?)`,
          record.id,
          record.databaseId,
          record.name,
          encodeSchemaObject(record.schemaJson),
          record.schemaVersion,
          record.migrationVersion,
        ).pipe(Effect.asVoid),
      findCollectionById: (id) =>
        query<CollectionRow>(`SELECT * FROM collections WHERE id = ?`, id).pipe(
          Effect.map((rows) => first(rows.map(toCollection))),
        ),
      findCollectionByName: (databaseId, name) =>
        query<CollectionRow>(
          `SELECT * FROM collections WHERE database_id = ? AND name = ?`,
          databaseId,
          name,
        ).pipe(Effect.map((rows) => first(rows.map(toCollection)))),
      listCollectionsByDatabase: (databaseId) =>
        query<CollectionRow>(`SELECT * FROM collections WHERE database_id = ?`, databaseId).pipe(
          Effect.map((rows) => rows.map(toCollection)),
        ),
      updateCollectionSchema: (collectionId, schemaJson, version) =>
        execute(
          `UPDATE collections SET schema_json = ?, schema_version = ? WHERE id = ?`,
          encodeSchemaObject(schemaJson),
          version,
          collectionId,
        ).pipe(Effect.asVoid),
      updateCollectionMigration: (collectionId, schemaJson, migrationVersion) =>
        execute(
          `UPDATE collections SET schema_json = ?, migration_version = ? WHERE id = ?`,
          encodeSchemaObject(schemaJson),
          migrationVersion,
          collectionId,
        ).pipe(Effect.asVoid),
      deleteCollection: (id) =>
        Effect.gen(function* () {
          yield* execute(`DELETE FROM collections WHERE id = ?`, id);
          yield* execute(`DELETE FROM schema_versions WHERE collection_id = ?`, id);
        }),

      addSchemaVersion: (record) =>
        execute(
          `INSERT OR REPLACE INTO schema_versions (collection_id, version, schema_json, data_migration_source) VALUES (?, ?, ?, ?)`,
          record.collectionId,
          record.version,
          encodeSchemaObject(record.schemaJson),
          record.dataMigrationSource,
        ).pipe(Effect.asVoid),
      findSchemaVersion: (collectionId, version) =>
        query<SchemaVersionRow>(
          `SELECT * FROM schema_versions WHERE collection_id = ? AND version = ?`,
          collectionId,
          version,
        ).pipe(Effect.map((rows) => first(rows.map(toSchemaVersion)))),
      listSchemaVersions: (collectionId) =>
        query<SchemaVersionRow>(
          `SELECT * FROM schema_versions WHERE collection_id = ? ORDER BY version ASC`,
          collectionId,
        ).pipe(Effect.map((rows) => rows.map(toSchemaVersion))),

      createUser: (record) =>
        execute(
          `INSERT INTO users (id, username, password_hash, is_superuser) VALUES (?, ?, ?, ?)`,
          record.id,
          record.username,
          record.passwordHash,
          pick(record.isSuperuser, 1, 0),
        ).pipe(Effect.asVoid),
      findUserById: (id) =>
        query<UserRow>(`SELECT * FROM users WHERE id = ?`, id).pipe(
          Effect.map((rows) => first(rows.map(toUser))),
        ),
      findUserByUsername: (username) =>
        query<UserRow>(`SELECT * FROM users WHERE username = ?`, username).pipe(
          Effect.map((rows) => first(rows.map(toUser))),
        ),
      listUsers: () =>
        query<UserRow>(`SELECT * FROM users`).pipe(Effect.map((rows) => rows.map(toUser))),
      deleteUser: (id) => execute(`DELETE FROM users WHERE id = ?`, id).pipe(Effect.asVoid),
      updateUserPasswordHash: (id, passwordHash) =>
        execute(`UPDATE users SET password_hash = ? WHERE id = ?`, passwordHash, id).pipe(
          Effect.asVoid,
        ),

      createGrant: (record) =>
        execute(
          `INSERT OR REPLACE INTO grants (id, user_id, database_id, permission) VALUES (?, ?, ?, ?)`,
          record.id,
          record.userId,
          record.databaseId,
          record.permission,
        ).pipe(Effect.asVoid),
      findGrant: (userId, databaseId) =>
        query<GrantRow>(
          `SELECT * FROM grants WHERE user_id = ? AND database_id = ?`,
          userId,
          databaseId,
        ).pipe(Effect.map((rows) => first(rows.map(toGrant)))),
      removeGrant: (userId, databaseId) =>
        execute(
          `DELETE FROM grants WHERE user_id = ? AND database_id = ?`,
          userId,
          databaseId,
        ).pipe(Effect.asVoid),
      listGrants: () =>
        query<GrantRow>(`SELECT * FROM grants`).pipe(Effect.map((rows) => rows.map(toGrant))),
      listGrantsByUser: (userId) =>
        query<GrantRow>(`SELECT * FROM grants WHERE user_id = ?`, userId).pipe(
          Effect.map((rows) => rows.map(toGrant)),
        ),

      createToken: (record) =>
        execute(
          `INSERT INTO tokens (id, token_hash, collection_id, document_id, permission, origins_json, expires_at_ms, used_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          record.id,
          record.tokenHash,
          record.collectionId,
          record.documentId,
          record.permission,
          encodeOrigins(record.origins),
          record.expiresAtMs,
          record.usedAt,
        ).pipe(Effect.asVoid),
      findTokenByHash: (tokenHash) =>
        query<TokenRow>(`SELECT * FROM tokens WHERE token_hash = ?`, tokenHash).pipe(
          Effect.map((rows) => first(rows.map(toToken))),
        ),
      markTokenUsed: (id, usedAt) =>
        execute(`UPDATE tokens SET used_at = ? WHERE id = ?`, usedAt, id).pipe(Effect.asVoid),

      registerDocument: (documentId, collectionId) =>
        execute(
          `INSERT OR REPLACE INTO document_index (document_id, collection_id, deleted_at) VALUES (?, ?, NULL)`,
          documentId,
          collectionId,
        ).pipe(Effect.asVoid),
      findDocumentIndex: (documentId) =>
        query<DocumentIndexRow>(
          `SELECT * FROM document_index WHERE document_id = ?`,
          documentId,
        ).pipe(Effect.map((rows) => first(rows.map(toDocumentIndex)))),
      listDocumentsByCollection: (collectionId) =>
        query<DocumentIndexRow>(
          `SELECT * FROM document_index WHERE collection_id = ? AND deleted_at IS NULL`,
          collectionId,
        ).pipe(Effect.map((rows) => rows.map(toDocumentIndex))),
      markDocumentDeleted: (documentId, deletedAt) =>
        execute(
          `UPDATE document_index SET deleted_at = ? WHERE document_id = ?`,
          deletedAt,
          documentId,
        ).pipe(Effect.asVoid),
    } satisfies ControlStoreApi;
  });
