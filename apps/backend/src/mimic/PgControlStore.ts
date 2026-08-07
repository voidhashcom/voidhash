import * as PgClient from "@effect/sql-pg/PgClient";
import type {
  CollectionRecord,
  ControlStoreApi,
  DatabaseRecord,
  DocumentIndexRecord,
  GrantRecord,
  SchemaVersionRecord,
  TokenRecord,
  UserRecord,
} from "@voidhash/mimic-db/core/store";
import { ControlStore } from "@voidhash/mimic-db/core/store";
import type { PgPlatformConfig } from "@voidhash/platform-selfhost/Postgres";
import { Effect, Layer, Predicate, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

interface ControlState {
  databases: DatabaseRecord[];
  collections: CollectionRecord[];
  schemaVersions: SchemaVersionRecord[];
  users: UserRecord[];
  grants: GrantRecord[];
  tokens: TokenRecord[];
  documents: DocumentIndexRecord[];
}

interface ControlStateRow {
  readonly state: unknown;
}

const encodeStateJson = Schema.encodeSync(Schema.UnknownFromJsonString);

const emptyState = (): ControlState => ({
  databases: [],
  collections: [],
  schemaVersions: [],
  users: [],
  grants: [],
  tokens: [],
  documents: [],
});

/**
 * Reads one array-valued field off the persisted control-state blob.
 *
 * `Array.isArray` narrows `unknown` to `Array<any>`, which lets the caller name
 * the row type without an assertion; anything else degrades to an empty list.
 */
const readRows = <A>(state: { readonly [key: PropertyKey]: unknown }, key: string): A[] => {
  const rows = state[key];
  if (Array.isArray(rows)) return rows;
  return [];
};

const migrationVersionOf = (value: number | null | undefined): number | null => {
  if (typeof value === "number") return value;
  return null;
};

const decodeState = (value: unknown): ControlState => {
  if (!Predicate.isObject(value)) return emptyState();
  return {
    databases: readRows<DatabaseRecord>(value, "databases"),
    collections: readRows<CollectionRecord>(value, "collections").map((collection) => ({
      ...collection,
      migrationVersion: migrationVersionOf(collection.migrationVersion),
    })),
    schemaVersions: readRows<SchemaVersionRecord>(value, "schemaVersions"),
    users: readRows<UserRecord>(value, "users"),
    grants: readRows<GrantRecord>(value, "grants"),
    tokens: readRows<TokenRecord>(value, "tokens"),
    documents: readRows<DocumentIndexRecord>(value, "documents"),
  };
};

const replaceBy = <A>(rows: A[], predicate: (row: A) => boolean, value: A): void => {
  const index = rows.findIndex(predicate);
  if (index === -1) rows.push(value);
  else rows[index] = value;
};

const removeBy = <A>(rows: A[], predicate: (row: A) => boolean): void => {
  const retained = rows.filter((row) => !predicate(row));
  rows.splice(0, rows.length, ...retained);
};

const ensureTable = (sql: SqlClient.SqlClient) =>
  sql.withTransaction(
    Effect.gen(function* () {
      yield* sql`SELECT pg_advisory_xact_lock(hashtext('voidhash_mimic_control_state_v1'))`;
      yield* sql`
        CREATE TABLE IF NOT EXISTS mimic_control_state (
          id TEXT PRIMARY KEY,
          state_json JSONB NOT NULL
        )
      `;
    }),
  );

/** Builds the persistent mimic control store over a shared Postgres client. */
export const makePgControlStore = (sql: SqlClient.SqlClient): ControlStoreApi => {
  const load = sql<ControlStateRow>`
    SELECT state_json AS "state" FROM mimic_control_state WHERE id = 'default'
  `.pipe(
    Effect.map((rows) => {
      const row = rows[0];
      if (!row) return emptyState();
      return decodeState(row.state);
    }),
    Effect.orDie,
  );

  const save = (state: ControlState) => {
    const json = encodeStateJson(state);
    return sql`
      INSERT INTO mimic_control_state (id, state_json)
      VALUES ('default', ${json}::jsonb)
      ON CONFLICT (id) DO UPDATE SET state_json = EXCLUDED.state_json
    `.pipe(Effect.asVoid, Effect.orDie);
  };

  const update = (mutate: (state: ControlState) => void) =>
    Effect.gen(function* () {
      const state = yield* load;
      mutate(state);
      yield* save(state);
    });

  return {
    createDatabase: (record) => update((state) => state.databases.push(record)),
    findDatabaseById: (id) =>
      load.pipe(Effect.map((state) => state.databases.find((row) => row.id === id))),
    findDatabaseByName: (name) =>
      load.pipe(Effect.map((state) => state.databases.find((row) => row.name === name))),
    listDatabases: () => load.pipe(Effect.map((state) => state.databases)),
    deleteDatabase: (id) => update((state) => removeBy(state.databases, (row) => row.id === id)),

    createCollection: (record) => update((state) => state.collections.push(record)),
    findCollectionById: (id) =>
      load.pipe(Effect.map((state) => state.collections.find((row) => row.id === id))),
    findCollectionByName: (databaseId, name) =>
      load.pipe(
        Effect.map((state) =>
          state.collections.find((row) => row.databaseId === databaseId && row.name === name),
        ),
      ),
    listCollectionsByDatabase: (databaseId) =>
      load.pipe(
        Effect.map((state) => state.collections.filter((row) => row.databaseId === databaseId)),
      ),
    updateCollectionSchema: (collectionId, schemaJson, version) =>
      update((state) => {
        const row = state.collections.find((candidate) => candidate.id === collectionId);
        if (row) {
          replaceBy(state.collections, (candidate) => candidate.id === collectionId, {
            ...row,
            schemaJson,
            schemaVersion: version,
          });
        }
      }),
    updateCollectionMigration: (collectionId, schemaJson, migrationVersion) =>
      update((state) => {
        const row = state.collections.find((candidate) => candidate.id === collectionId);
        if (row) {
          replaceBy(state.collections, (candidate) => candidate.id === collectionId, {
            ...row,
            schemaJson,
            migrationVersion,
          });
        }
      }),
    deleteCollection: (id) =>
      update((state) => {
        removeBy(state.collections, (row) => row.id === id);
        removeBy(state.schemaVersions, (row) => row.collectionId === id);
      }),

    addSchemaVersion: (record) =>
      update((state) =>
        replaceBy(
          state.schemaVersions,
          (row) => row.collectionId === record.collectionId && row.version === record.version,
          record,
        ),
      ),
    findSchemaVersion: (collectionId, version) =>
      load.pipe(
        Effect.map((state) =>
          state.schemaVersions.find(
            (row) => row.collectionId === collectionId && row.version === version,
          ),
        ),
      ),
    listSchemaVersions: (collectionId) =>
      load.pipe(
        Effect.map((state) =>
          state.schemaVersions
            .filter((row) => row.collectionId === collectionId)
            .sort((left, right) => left.version - right.version),
        ),
      ),

    createUser: (record) => update((state) => state.users.push(record)),
    findUserById: (id) =>
      load.pipe(Effect.map((state) => state.users.find((row) => row.id === id))),
    findUserByUsername: (username) =>
      load.pipe(Effect.map((state) => state.users.find((row) => row.username === username))),
    listUsers: () => load.pipe(Effect.map((state) => state.users)),
    deleteUser: (id) => update((state) => removeBy(state.users, (row) => row.id === id)),
    updateUserPasswordHash: (id, passwordHash) =>
      update((state) => {
        const row = state.users.find((candidate) => candidate.id === id);
        if (row) {
          replaceBy(state.users, (candidate) => candidate.id === id, { ...row, passwordHash });
        }
      }),

    createGrant: (record) =>
      update((state) =>
        replaceBy(
          state.grants,
          (row) => row.userId === record.userId && row.databaseId === record.databaseId,
          record,
        ),
      ),
    findGrant: (userId, databaseId) =>
      load.pipe(
        Effect.map((state) =>
          state.grants.find((row) => row.userId === userId && row.databaseId === databaseId),
        ),
      ),
    removeGrant: (userId, databaseId) =>
      update((state) =>
        removeBy(state.grants, (row) => row.userId === userId && row.databaseId === databaseId),
      ),
    listGrants: () => load.pipe(Effect.map((state) => state.grants)),
    listGrantsByUser: (userId) =>
      load.pipe(Effect.map((state) => state.grants.filter((row) => row.userId === userId))),

    createToken: (record) => update((state) => state.tokens.push(record)),
    findTokenByHash: (tokenHash) =>
      load.pipe(Effect.map((state) => state.tokens.find((row) => row.tokenHash === tokenHash))),
    markTokenUsed: (id, usedAt) =>
      update((state) => {
        const row = state.tokens.find((candidate) => candidate.id === id);
        if (row) replaceBy(state.tokens, (candidate) => candidate.id === id, { ...row, usedAt });
      }),

    registerDocument: (documentId, collectionId) =>
      update((state) =>
        replaceBy(state.documents, (row) => row.documentId === documentId, {
          documentId,
          collectionId,
          deletedAt: null,
        }),
      ),
    findDocumentIndex: (documentId) =>
      load.pipe(
        Effect.map((state) => state.documents.find((row) => row.documentId === documentId)),
      ),
    listDocumentsByCollection: (collectionId) =>
      load.pipe(
        Effect.map((state) =>
          state.documents.filter(
            (row) => row.collectionId === collectionId && row.deletedAt === null,
          ),
        ),
      ),
    markDocumentDeleted: (documentId, deletedAt) =>
      update((state) => {
        const row = state.documents.find((candidate) => candidate.documentId === documentId);
        if (row) {
          replaceBy(state.documents, (candidate) => candidate.documentId === documentId, {
            ...row,
            deletedAt,
          });
        }
      }),
  };
};

/** Persistent Postgres control-store layer for the single-node mimic host. */
export const PgControlStoreLive = (config: PgPlatformConfig): Layer.Layer<ControlStore> =>
  Layer.effect(
    ControlStore,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* ensureTable(sql);
      return makePgControlStore(sql);
    }),
  ).pipe(
    Layer.provide(
      PgClient.layer({
        host: config.host,
        port: config.port,
        database: config.database,
        username: config.username,
        password: config.password,
        ssl: config.ssl,
      }),
    ),
    Layer.orDie,
  );
