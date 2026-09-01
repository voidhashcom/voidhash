import * as Arr from "effect/Array";
import { cloneValue, type Command } from "@voidhash/mimic-core";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Order from "effect/Order";

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
  let databases = HashMap.empty<string, DatabaseRecord>();
  let collections = HashMap.empty<string, CollectionRecord>();
  let schemaVersions = HashMap.empty<string, SchemaVersionRecord>();
  let users = HashMap.empty<string, UserRecord>();
  let grants = HashMap.empty<string, GrantRecord>();
  let tokens = HashMap.empty<string, TokenRecord>();
  let documents = HashMap.empty<string, DocumentIndexRecord>();

  return {
    createDatabase: (record) =>
      sync(() => void (databases = HashMap.set(databases, record.id, record))),
    findDatabaseById: (id) => sync(() => HashMap.get(databases, id)),
    findDatabaseByName: (name) =>
      sync(() => Arr.findFirst(HashMap.values(databases), (row) => row.name === name)),
    listDatabases: () => sync(() => Array.from(HashMap.values(databases))),
    deleteDatabase: (id) => sync(() => void (databases = HashMap.remove(databases, id))),

    createCollection: (record) =>
      sync(() => void (collections = HashMap.set(collections, record.id, record))),
    findCollectionById: (id) => sync(() => HashMap.get(collections, id)),
    findCollectionByName: (databaseId, name) =>
      sync(() =>
        Arr.findFirst(
          HashMap.values(collections),
          (row) => row.databaseId === databaseId && row.name === name,
        ),
      ),
    listCollectionsByDatabase: (databaseId) =>
      sync(() =>
        Array.from(HashMap.values(collections)).filter((row) => row.databaseId === databaseId),
      ),
    updateCollectionSchema: (collectionId, schemaJson, version) =>
      sync(() => {
        collections = HashMap.modify(collections, collectionId, (existing) => ({
          ...existing,
          schemaJson,
          schemaVersion: version,
        }));
      }),
    updateCollectionMigration: (collectionId, schemaJson, migrationVersion) =>
      sync(() => {
        collections = HashMap.modify(collections, collectionId, (existing) => ({
          ...existing,
          schemaJson,
          migrationVersion: Option.some(migrationVersion),
        }));
      }),
    deleteCollection: (id) =>
      sync(() => {
        collections = HashMap.remove(collections, id);
        schemaVersions = HashMap.filter(schemaVersions, (_value, key) => !key.startsWith(`${id}:`));
      }),

    addSchemaVersion: (record) =>
      sync(
        () =>
          void (schemaVersions = HashMap.set(
            schemaVersions,
            `${record.collectionId}:${record.version}`,
            record,
          )),
      ),
    findSchemaVersion: (collectionId, version) =>
      sync(() => HashMap.get(schemaVersions, `${collectionId}:${version}`)),
    listSchemaVersions: (collectionId) =>
      sync(() =>
        Arr.sort(
          Array.from(HashMap.values(schemaVersions)).filter(
            (row) => row.collectionId === collectionId,
          ),
          Order.mapInput<number, SchemaVersionRecord>(Order.Number, (row) => row.version),
        ),
      ),

    createUser: (record) => sync(() => void (users = HashMap.set(users, record.id, record))),
    findUserById: (id) => sync(() => HashMap.get(users, id)),
    findUserByUsername: (username) =>
      sync(() => Arr.findFirst(HashMap.values(users), (row) => row.username === username)),
    listUsers: () => sync(() => Array.from(HashMap.values(users))),
    deleteUser: (id) => sync(() => void (users = HashMap.remove(users, id))),
    updateUserPasswordHash: (id, passwordHash) =>
      sync(() => {
        users = HashMap.modify(users, id, (existing) => ({ ...existing, passwordHash }));
      }),

    createGrant: (record) =>
      sync(
        () => void (grants = HashMap.set(grants, `${record.userId}:${record.databaseId}`, record)),
      ),
    findGrant: (userId, databaseId) => sync(() => HashMap.get(grants, `${userId}:${databaseId}`)),
    removeGrant: (userId, databaseId) =>
      sync(() => void (grants = HashMap.remove(grants, `${userId}:${databaseId}`))),
    listGrants: () => sync(() => Array.from(HashMap.values(grants))),
    listGrantsByUser: (userId) =>
      sync(() => Array.from(HashMap.values(grants)).filter((row) => row.userId === userId)),

    createToken: (record) => sync(() => void (tokens = HashMap.set(tokens, record.id, record))),
    findTokenByHash: (tokenHash) =>
      sync(() => Arr.findFirst(HashMap.values(tokens), (row) => row.tokenHash === tokenHash)),
    markTokenUsed: (id, usedAt) =>
      sync(() => {
        tokens = HashMap.modify(tokens, id, (existing) => ({
          ...existing,
          usedAt: Option.some(usedAt),
        }));
      }),

    registerDocument: (documentId, collectionId) =>
      sync(
        () =>
          void (documents = HashMap.set(documents, documentId, {
            documentId,
            collectionId,
            deletedAt: Option.none(),
          })),
      ),
    findDocumentIndex: (documentId) => sync(() => HashMap.get(documents, documentId)),
    listDocumentsByCollection: (collectionId) =>
      sync(() =>
        Array.from(HashMap.values(documents)).filter(
          (row) => row.collectionId === collectionId && Option.isNone(row.deletedAt),
        ),
      ),
    markDocumentDeleted: (documentId, deletedAt) =>
      sync(() => {
        documents = HashMap.modify(documents, documentId, (existing) => ({
          ...existing,
          deletedAt: Option.some(deletedAt),
        }));
      }),
  };
};

export const MemoryControlStoreLive = Layer.sync(ControlStore, makeMemoryControlStore);

/** In-memory `DocumentStore` for a single document, backing dev + tests. */
export const makeMemoryDocumentStore = (): DocumentStoreApi => {
  let meta = Option.none<DocumentMeta>();
  const snapshots: SnapshotRow[] = [];
  const commands: CommandRow[] = [];

  return {
    readMeta: () => sync(() => meta),
    initialize: (collectionId, value, schemaVersion, migrationVersion) =>
      sync(() => {
        meta = Option.some({
          collectionId,
          schemaVersion,
          migrationVersion,
          currentSeq: 0,
          snapshotSeq: 0,
          deletedAt: Option.none(),
        });
        snapshots.length = 0;
        commands.length = 0;
        snapshots.push({ seq: 0, value: cloneValue(value), schemaVersion });
      }),
    loadLatestSnapshot: () =>
      sync(() => {
        if (!Arr.isReadonlyArrayNonEmpty(snapshots)) return Option.none();
        return Option.some(
          snapshots.reduce((best, row) => {
            if (row.seq >= best.seq) return row;
            return best;
          }),
        );
      }),
    listCommandsAfter: (seq) =>
      sync(() =>
        Arr.sort(
          commands.filter((row) => row.seq > seq),
          Order.mapInput<number, CommandRow>(Order.Number, (row) => row.seq),
        ),
      ),
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
        if (Option.isSome(meta)) {
          meta = Option.some({
            ...meta.value,
            schemaVersion,
            migrationVersion,
            snapshotSeq: seq,
          });
        }
      }),
    setMeta: (patch) =>
      sync(() => {
        if (Option.isSome(meta)) meta = Option.some({ ...meta.value, ...patch });
      }),
  };
};
