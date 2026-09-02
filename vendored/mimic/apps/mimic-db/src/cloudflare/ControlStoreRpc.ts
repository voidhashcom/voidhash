import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import type {
  CollectionRecord,
  ControlStoreApi,
  DocumentIndexRecord,
  SchemaVersionRecord,
  TokenRecord,
} from "../core/store.ts";

type Nullable<A> = A | typeof Schema.Null.Type;

interface RpcCollectionRecord extends Omit<CollectionRecord, "migrationVersion"> {
  readonly migrationVersion: Nullable<number>;
}

interface RpcSchemaVersionRecord extends Omit<SchemaVersionRecord, "dataMigrationSource"> {
  readonly dataMigrationSource: Nullable<string>;
}

interface RpcTokenRecord extends Omit<TokenRecord, "usedAt"> {
  readonly usedAt: Nullable<number>;
}

interface RpcDocumentIndexRecord extends Omit<DocumentIndexRecord, "deletedAt"> {
  readonly deletedAt: Nullable<number>;
}

const encodeCollection = (record: CollectionRecord): RpcCollectionRecord => ({
  ...record,
  migrationVersion: Option.getOrNull(record.migrationVersion),
});

const decodeCollection = (record: RpcCollectionRecord): CollectionRecord => ({
  ...record,
  migrationVersion: Option.fromNullishOr(record.migrationVersion),
});

const encodeSchemaVersion = (record: SchemaVersionRecord): RpcSchemaVersionRecord => ({
  ...record,
  dataMigrationSource: Option.getOrNull(record.dataMigrationSource),
});

const decodeSchemaVersion = (record: RpcSchemaVersionRecord): SchemaVersionRecord => ({
  ...record,
  dataMigrationSource: Option.fromNullishOr(record.dataMigrationSource),
});

const encodeToken = (record: TokenRecord): RpcTokenRecord => ({
  ...record,
  usedAt: Option.getOrNull(record.usedAt),
});

const decodeToken = (record: RpcTokenRecord): TokenRecord => ({
  ...record,
  usedAt: Option.fromNullishOr(record.usedAt),
});

const encodeDocumentIndex = (record: DocumentIndexRecord): RpcDocumentIndexRecord => ({
  ...record,
  deletedAt: Option.getOrNull(record.deletedAt),
});

const decodeDocumentIndex = (record: RpcDocumentIndexRecord): DocumentIndexRecord => ({
  ...record,
  deletedAt: Option.fromNullishOr(record.deletedAt),
});

const encodeOptional = <A, B>(value: Option.Option<A>, encode: (value: A) => B): Nullable<B> =>
  Option.match(value, { onNone: () => Option.getOrNull(Option.none<B>()), onSome: encode });

const decodeOptional = <A, B>(value: Nullable<A>, decode: (value: A) => B): Option.Option<B> =>
  Option.map(Option.fromNullishOr(value), decode);

/** Converts the Effect-native store into a structured-cloneable Durable Object surface. */
export const makeControlStoreRpcServer = (store: ControlStoreApi) => ({
  createDatabase: store.createDatabase,
  findDatabaseById: (id: string) =>
    store.findDatabaseById(id).pipe(Effect.map((value) => Option.getOrNull(value))),
  findDatabaseByName: (name: string) =>
    store.findDatabaseByName(name).pipe(Effect.map((value) => Option.getOrNull(value))),
  listDatabases: store.listDatabases,
  deleteDatabase: store.deleteDatabase,
  createCollection: (record: RpcCollectionRecord) =>
    store.createCollection(decodeCollection(record)),
  findCollectionById: (id: string) =>
    store
      .findCollectionById(id)
      .pipe(Effect.map((value) => encodeOptional(value, encodeCollection))),
  findCollectionByName: (databaseId: string, name: string) =>
    store
      .findCollectionByName(databaseId, name)
      .pipe(Effect.map((value) => encodeOptional(value, encodeCollection))),
  listCollectionsByDatabase: (databaseId: string) =>
    store.listCollectionsByDatabase(databaseId).pipe(Effect.map(Arr.map(encodeCollection))),
  updateCollectionSchema: store.updateCollectionSchema,
  updateCollectionMigration: store.updateCollectionMigration,
  deleteCollection: store.deleteCollection,
  addSchemaVersion: (record: RpcSchemaVersionRecord) =>
    store.addSchemaVersion(decodeSchemaVersion(record)),
  findSchemaVersion: (collectionId: string, version: number) =>
    store
      .findSchemaVersion(collectionId, version)
      .pipe(Effect.map((value) => encodeOptional(value, encodeSchemaVersion))),
  listSchemaVersions: (collectionId: string) =>
    store.listSchemaVersions(collectionId).pipe(Effect.map(Arr.map(encodeSchemaVersion))),
  createUser: store.createUser,
  findUserById: (id: string) =>
    store.findUserById(id).pipe(Effect.map((value) => Option.getOrNull(value))),
  findUserByUsername: (username: string) =>
    store.findUserByUsername(username).pipe(Effect.map((value) => Option.getOrNull(value))),
  listUsers: store.listUsers,
  deleteUser: store.deleteUser,
  updateUserPasswordHash: store.updateUserPasswordHash,
  createGrant: store.createGrant,
  findGrant: (userId: string, databaseId: string) =>
    store.findGrant(userId, databaseId).pipe(Effect.map((value) => Option.getOrNull(value))),
  removeGrant: store.removeGrant,
  listGrants: store.listGrants,
  listGrantsByUser: store.listGrantsByUser,
  createToken: (record: RpcTokenRecord) => store.createToken(decodeToken(record)),
  findTokenByHash: (tokenHash: string) =>
    store
      .findTokenByHash(tokenHash)
      .pipe(Effect.map((value) => encodeOptional(value, encodeToken))),
  markTokenUsed: store.markTokenUsed,
  registerDocument: store.registerDocument,
  findDocumentIndex: (documentId: string) =>
    store
      .findDocumentIndex(documentId)
      .pipe(Effect.map((value) => encodeOptional(value, encodeDocumentIndex))),
  listDocumentsByCollection: (collectionId: string) =>
    store.listDocumentsByCollection(collectionId).pipe(Effect.map(Arr.map(encodeDocumentIndex))),
  markDocumentDeleted: store.markDocumentDeleted,
});

type ControlStoreRpcServer = ReturnType<typeof makeControlStoreRpcServer>;

type WithContext<Method, R> = Method extends (
  ...args: infer Args
) => Effect.Effect<infer Success, infer Error, infer _Context>
  ? (...args: Args) => Effect.Effect<Success, Error, R>
  : Method;

type ControlStoreRpcClient<R> = {
  readonly [Key in keyof ControlStoreRpcServer]: WithContext<ControlStoreRpcServer[Key], R>;
};

/** Restores Effect `Option` values after a Durable Object RPC call. */
export const makeControlStoreRpcClient = <R>(
  remote: () => ControlStoreRpcClient<R>,
  provideContext: <A, E>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E>,
): ControlStoreApi => ({
  createDatabase: (record) => provideContext(remote().createDatabase(record)),
  findDatabaseById: (id) =>
    provideContext(remote().findDatabaseById(id)).pipe(Effect.map(Option.fromNullishOr)),
  findDatabaseByName: (name) =>
    provideContext(remote().findDatabaseByName(name)).pipe(Effect.map(Option.fromNullishOr)),
  listDatabases: () => provideContext(remote().listDatabases()),
  deleteDatabase: (id) => provideContext(remote().deleteDatabase(id)),
  createCollection: (record) => provideContext(remote().createCollection(encodeCollection(record))),
  findCollectionById: (id) =>
    provideContext(remote().findCollectionById(id)).pipe(
      Effect.map((value) => decodeOptional(value, decodeCollection)),
    ),
  findCollectionByName: (databaseId, name) =>
    provideContext(remote().findCollectionByName(databaseId, name)).pipe(
      Effect.map((value) => decodeOptional(value, decodeCollection)),
    ),
  listCollectionsByDatabase: (databaseId) =>
    provideContext(remote().listCollectionsByDatabase(databaseId)).pipe(
      Effect.map(Arr.map(decodeCollection)),
    ),
  updateCollectionSchema: (collectionId, schemaJson, version) =>
    provideContext(remote().updateCollectionSchema(collectionId, schemaJson, version)),
  updateCollectionMigration: (collectionId, schemaJson, migrationVersion) =>
    provideContext(remote().updateCollectionMigration(collectionId, schemaJson, migrationVersion)),
  deleteCollection: (id) => provideContext(remote().deleteCollection(id)),
  addSchemaVersion: (record) =>
    provideContext(remote().addSchemaVersion(encodeSchemaVersion(record))),
  findSchemaVersion: (collectionId, version) =>
    provideContext(remote().findSchemaVersion(collectionId, version)).pipe(
      Effect.map((value) => decodeOptional(value, decodeSchemaVersion)),
    ),
  listSchemaVersions: (collectionId) =>
    provideContext(remote().listSchemaVersions(collectionId)).pipe(
      Effect.map(Arr.map(decodeSchemaVersion)),
    ),
  createUser: (record) => provideContext(remote().createUser(record)),
  findUserById: (id) =>
    provideContext(remote().findUserById(id)).pipe(Effect.map(Option.fromNullishOr)),
  findUserByUsername: (username) =>
    provideContext(remote().findUserByUsername(username)).pipe(Effect.map(Option.fromNullishOr)),
  listUsers: () => provideContext(remote().listUsers()),
  deleteUser: (id) => provideContext(remote().deleteUser(id)),
  updateUserPasswordHash: (id, passwordHash) =>
    provideContext(remote().updateUserPasswordHash(id, passwordHash)),
  createGrant: (record) => provideContext(remote().createGrant(record)),
  findGrant: (userId, databaseId) =>
    provideContext(remote().findGrant(userId, databaseId)).pipe(Effect.map(Option.fromNullishOr)),
  removeGrant: (userId, databaseId) => provideContext(remote().removeGrant(userId, databaseId)),
  listGrants: () => provideContext(remote().listGrants()),
  listGrantsByUser: (userId) => provideContext(remote().listGrantsByUser(userId)),
  createToken: (record) => provideContext(remote().createToken(encodeToken(record))),
  findTokenByHash: (tokenHash) =>
    provideContext(remote().findTokenByHash(tokenHash)).pipe(
      Effect.map((value) => decodeOptional(value, decodeToken)),
    ),
  markTokenUsed: (id, usedAt) => provideContext(remote().markTokenUsed(id, usedAt)),
  registerDocument: (documentId, collectionId) =>
    provideContext(remote().registerDocument(documentId, collectionId)),
  findDocumentIndex: (documentId) =>
    provideContext(remote().findDocumentIndex(documentId)).pipe(
      Effect.map((value) => decodeOptional(value, decodeDocumentIndex)),
    ),
  listDocumentsByCollection: (collectionId) =>
    provideContext(remote().listDocumentsByCollection(collectionId)).pipe(
      Effect.map(Arr.map(decodeDocumentIndex)),
    ),
  markDocumentDeleted: (documentId, deletedAt) =>
    provideContext(remote().markDocumentDeleted(documentId, deletedAt)),
});
