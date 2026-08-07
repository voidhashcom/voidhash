import { cloneValue, type Command } from "@voidhash/mimic-core";
import { Effect, Layer } from "effect";

import {
  ControlStore,
  type ControlStoreApi,
  type CollectionRecord,
  type DatabaseRecord,
  type DocumentIndexRecord,
  type DocumentMeta,
  type DocumentStoreApi,
  type GrantRecord,
  type SchemaVersionRecord,
  type SnapshotRow,
  type CommandRow,
  type TokenRecord,
  type UserRecord,
} from "./store.ts";

const sync = Effect.sync;

/** In-memory `ControlStore`, backing dev + tests. */
export const makeMemoryControlStore = (): ControlStoreApi => {
  const databases = new Map<string, DatabaseRecord>();
  const collections = new Map<string, CollectionRecord>();
  const schemaVersions = new Map<string, SchemaVersionRecord>(); // key `${collectionId}:${version}`
  const users = new Map<string, UserRecord>();
  const grants = new Map<string, GrantRecord>(); // key `${userId}:${databaseId}`
  const tokens = new Map<string, TokenRecord>();
  const documents = new Map<string, DocumentIndexRecord>();

  return {
    createDatabase: (record) => sync(() => void databases.set(record.id, record)),
    findDatabaseById: (id) => sync(() => databases.get(id)),
    findDatabaseByName: (name) =>
      sync(() => [...databases.values()].find((row) => row.name === name)),
    listDatabases: () => sync(() => [...databases.values()]),
    deleteDatabase: (id) => sync(() => void databases.delete(id)),

    createCollection: (record) => sync(() => void collections.set(record.id, record)),
    findCollectionById: (id) => sync(() => collections.get(id)),
    findCollectionByName: (databaseId, name) =>
      sync(() =>
        [...collections.values()].find((row) => row.databaseId === databaseId && row.name === name),
      ),
    listCollectionsByDatabase: (databaseId) =>
      sync(() => [...collections.values()].filter((row) => row.databaseId === databaseId)),
    updateCollectionSchema: (collectionId, schemaJson, version) =>
      sync(() => {
        const existing = collections.get(collectionId);
        if (existing) {
          collections.set(collectionId, { ...existing, schemaJson, schemaVersion: version });
        }
      }),
    updateCollectionMigration: (collectionId, schemaJson, migrationVersion) =>
      sync(() => {
        const existing = collections.get(collectionId);
        if (existing) {
          collections.set(collectionId, { ...existing, schemaJson, migrationVersion });
        }
      }),
    deleteCollection: (id) =>
      sync(() => {
        collections.delete(id);
        for (const key of schemaVersions.keys()) {
          if (key.startsWith(`${id}:`)) schemaVersions.delete(key);
        }
      }),

    addSchemaVersion: (record) =>
      sync(() => void schemaVersions.set(`${record.collectionId}:${record.version}`, record)),
    findSchemaVersion: (collectionId, version) =>
      sync(() => schemaVersions.get(`${collectionId}:${version}`)),
    listSchemaVersions: (collectionId) =>
      sync(() =>
        [...schemaVersions.values()]
          .filter((row) => row.collectionId === collectionId)
          .sort((a, b) => a.version - b.version),
      ),

    createUser: (record) => sync(() => void users.set(record.id, record)),
    findUserById: (id) => sync(() => users.get(id)),
    findUserByUsername: (username) =>
      sync(() => [...users.values()].find((row) => row.username === username)),
    listUsers: () => sync(() => [...users.values()]),
    deleteUser: (id) => sync(() => void users.delete(id)),
    updateUserPasswordHash: (id, passwordHash) =>
      sync(() => {
        const existing = users.get(id);
        if (existing) users.set(id, { ...existing, passwordHash });
      }),

    createGrant: (record) =>
      sync(() => void grants.set(`${record.userId}:${record.databaseId}`, record)),
    findGrant: (userId, databaseId) => sync(() => grants.get(`${userId}:${databaseId}`)),
    removeGrant: (userId, databaseId) => sync(() => void grants.delete(`${userId}:${databaseId}`)),
    listGrants: () => sync(() => [...grants.values()]),
    listGrantsByUser: (userId) =>
      sync(() => [...grants.values()].filter((row) => row.userId === userId)),

    createToken: (record) => sync(() => void tokens.set(record.id, record)),
    findTokenByHash: (tokenHash) =>
      sync(() => [...tokens.values()].find((row) => row.tokenHash === tokenHash)),
    markTokenUsed: (id, usedAt) =>
      sync(() => {
        const existing = tokens.get(id);
        if (existing) tokens.set(id, { ...existing, usedAt });
      }),

    registerDocument: (documentId, collectionId) =>
      sync(() => void documents.set(documentId, { documentId, collectionId, deletedAt: null })),
    findDocumentIndex: (documentId) => sync(() => documents.get(documentId)),
    listDocumentsByCollection: (collectionId) =>
      sync(() =>
        [...documents.values()].filter(
          (row) => row.collectionId === collectionId && row.deletedAt === null,
        ),
      ),
    markDocumentDeleted: (documentId, deletedAt) =>
      sync(() => {
        const existing = documents.get(documentId);
        if (existing) documents.set(documentId, { ...existing, deletedAt });
      }),
  };
};

export const MemoryControlStoreLive = Layer.sync(ControlStore, makeMemoryControlStore);

/** In-memory `DocumentStore` for a single document, backing dev + tests. */
export const makeMemoryDocumentStore = (): DocumentStoreApi => {
  let meta: DocumentMeta | undefined;
  const snapshots: SnapshotRow[] = [];
  const commands: CommandRow[] = [];

  return {
    readMeta: () => sync(() => meta),
    initialize: (collectionId, value, schemaVersion, migrationVersion) =>
      sync(() => {
        meta = {
          collectionId,
          schemaVersion,
          migrationVersion,
          currentSeq: 0,
          snapshotSeq: 0,
          deletedAt: null,
        };
        snapshots.length = 0;
        commands.length = 0;
        snapshots.push({ seq: 0, value: cloneValue(value), schemaVersion });
      }),
    loadLatestSnapshot: () =>
      sync(() => {
        if (snapshots.length === 0) return undefined;
        return snapshots.reduce((best, row) => {
          if (row.seq >= best.seq) return row;
          return best;
        });
      }),
    listCommandsAfter: (seq) =>
      sync(() => commands.filter((row) => row.seq > seq).sort((a, b) => a.seq - b.seq)),
    appendCommands: (fromSeq, cmds: readonly Command[], txId) =>
      sync(() => {
        cmds.forEach((command, index) => {
          commands.push({ seq: fromSeq + 1 + index, command, txId });
        });
      }),
    writeSnapshot: (seq, value, schemaVersion) =>
      sync(() => void snapshots.push({ seq, value: cloneValue(value), schemaVersion })),
    commitMigration: (seq, value, schemaVersion, migrationVersion) =>
      sync(() => {
        const index = snapshots.findIndex((row) => row.seq === seq);
        const snapshot = { seq, value: cloneValue(value), schemaVersion };
        if (index === -1) snapshots.push(snapshot);
        else snapshots[index] = snapshot;
        if (meta) {
          meta = {
            ...meta,
            schemaVersion,
            migrationVersion,
            snapshotSeq: seq,
          };
        }
      }),
    setMeta: (patch) =>
      sync(() => {
        if (meta) meta = { ...meta, ...patch };
      }),
  };
};
