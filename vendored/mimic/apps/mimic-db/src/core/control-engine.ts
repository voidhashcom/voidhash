import * as Arr from "effect/Array";
import type { SchemaObject, Value } from "@voidhash/mimic-core";
import type { MigrationRegistry } from "@voidhash/mimic-server/migrate";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  type DatabasePermission,
  type DocumentPermission,
} from "@voidhash/mimic-server/rpc";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { normalizeSchemaObject, sanitizeValueForSchema } from "../document/schema.ts";
import { hashHex, randomId } from "./ids.ts";
import { EmptyMigrationRegistry, isRegistryCollection } from "./migration-registry.ts";
import type { CollectionRecord, ControlStoreApi } from "./store.ts";

const notFound = (message: string): NotFoundError =>
  new NotFoundError({ code: "not_found", message });
const conflict = (message: string): ConflictError =>
  new ConflictError({ code: "conflict", message });
const unauthorized = (message: string): UnauthorizedError =>
  new UnauthorizedError({ code: "unauthorized", message });
const forbidden = (message: string): ForbiddenError =>
  new ForbiddenError({ code: "forbidden", message });

const permissionRank = (permission: DatabasePermission): number => {
  if (permission === "read") return 1;
  if (permission === "write") return 2;
  return 3;
};

interface CollectionView {
  readonly id: string;
  readonly databaseId: string;
  readonly name: string;
  readonly schema: SchemaObject;
  readonly schemaVersion: number;
  readonly migrationVersion: Option.Option<number>;
}

const toCollectionView = (record: CollectionRecord): CollectionView => ({
  id: record.id,
  databaseId: record.databaseId,
  name: record.name,
  schema: record.schemaJson,
  schemaVersion: record.schemaVersion,
  migrationVersion: record.migrationVersion,
});

export interface ControlEngineApi {
  readonly ensureRootUser: (username: string, password: string) => Effect.Effect<void>;
  readonly authenticateBasic: ControlStoreThrows<{
    readonly userId: string;
    readonly username: string;
    readonly isSuperuser: boolean;
  }>;
  readonly authenticateDocumentToken: (
    token: string,
    collectionId: string,
    documentId: string,
    origin: Option.Option<string>,
  ) => Effect.Effect<
    { readonly tokenId: string; readonly permission: DocumentPermission },
    UnauthorizedError
  >;
  readonly createDatabase: (
    name: string,
    description: string,
  ) => Effect.Effect<
    { readonly id: string; readonly name: string; readonly description: string },
    ConflictError
  >;
  readonly listDatabases: () => Effect.Effect<
    readonly { readonly id: string; readonly name: string; readonly description: string }[]
  >;
  readonly deleteDatabase: (
    databaseId: string,
  ) => Effect.Effect<void, NotFoundError | ConflictError>;
  readonly createCollection: (
    databaseId: string,
    name: string,
    schemaInput: unknown,
  ) => Effect.Effect<CollectionView, NotFoundError | ConflictError>;
  readonly listCollections: (databaseId: string) => Effect.Effect<readonly CollectionView[]>;
  readonly deleteCollection: (
    collectionId: string,
  ) => Effect.Effect<void, NotFoundError | ConflictError>;
  readonly createUser: (
    username: string,
    password: string,
  ) => Effect.Effect<
    { readonly id: string; readonly username: string; readonly isSuperuser: boolean },
    ConflictError
  >;
  readonly listUsers: () => Effect.Effect<
    readonly { readonly id: string; readonly username: string; readonly isSuperuser: boolean }[]
  >;
  readonly deleteUser: (userId: string) => Effect.Effect<void, NotFoundError>;
  readonly grantPermission: (
    userId: string,
    databaseId: string,
    permission: DatabasePermission,
  ) => Effect.Effect<void, NotFoundError>;
  readonly revokePermission: (
    userId: string,
    databaseId: string,
  ) => Effect.Effect<void, NotFoundError>;
  readonly listGrants: (userId: Option.Option<string>) => Effect.Effect<
    readonly {
      readonly id: string;
      readonly userId: string;
      readonly databaseId: string;
      readonly permission: DatabasePermission;
    }[]
  >;
  readonly createDocumentToken: (
    collectionId: string,
    documentId: string,
    permission: DocumentPermission,
    origins: readonly string[],
    expiresInSeconds: Option.Option<number>,
  ) => Effect.Effect<{ readonly token: string }, NotFoundError>;
  readonly ensureDatabasePermission: (
    userId: string,
    isSuperuser: boolean,
    databaseId: string,
    required: DatabasePermission,
  ) => Effect.Effect<void, NotFoundError | ForbiddenError>;
  readonly databaseIdForCollection: (collectionId: string) => Effect.Effect<string, NotFoundError>;
  /**
   * Resolve the collection a document creation targets and sanitize its value.
   *
   * `isMaterialized` optionally probes whether a document id already has
   * durable state in its document object (per-collection, addressed by
   * `collectionId + documentId`). It is consulted only for the ambiguous case
   * where the index row is live under the target collection: an index entry
   * whose document object was never materialized (or lost its state) is a
   * half-dead reservation — get reports NotFound while create would otherwise
   * conflict forever — so `prepareDocument` heals it (re-register + re-seed)
   * instead of conflicting. Omit the probe to keep the pure index-only
   * behaviour (a live same-collection row is always a conflict).
   */
  readonly prepareDocument: (
    collectionId: string,
    id: Option.Option<string>,
    value: unknown,
    isMaterialized: Option.Option<(documentId: string) => Effect.Effect<boolean>>,
  ) => Effect.Effect<
    {
      readonly documentId: string;
      readonly value: Value;
      readonly schemaVersion: number;
      readonly migrationVersion: Option.Option<number>;
    },
    NotFoundError | ConflictError
  >;
  readonly findCollection: (collectionId: string) => Effect.Effect<CollectionRecord, NotFoundError>;
  readonly findDocument: (
    collectionId: string,
    documentId: string,
  ) => Effect.Effect<void, NotFoundError>;
  readonly listDocumentIds: (
    collectionId: string,
  ) => Effect.Effect<readonly string[], NotFoundError>;
  readonly markDocumentDeleted: (documentId: string) => Effect.Effect<void>;
  readonly store: ControlStoreApi;
}

type ControlStoreThrows<A> = (
  username: string,
  password: string,
) => Effect.Effect<A, UnauthorizedError>;

/**
 * Control-plane logic over a `ControlStore`. Runs inside one serialized control
 * entity in production and in-process (over `makeMemoryControlStore`) for dev/test.
 *
 * Registry-owned schemas are immutable through the public control API.
 */
export const makeControlEngine = (
  store: ControlStoreApi,
  registry: MigrationRegistry = EmptyMigrationRegistry,
): ControlEngineApi => {
  const findCollection: ControlEngineApi["findCollection"] = (collectionId) =>
    store.findCollectionById(collectionId).pipe(
      Effect.flatMap((record) => {
        if (Option.isNone(record))
          return Effect.fail(notFound(`Collection not found: ${collectionId}`));
        return Effect.succeed(record.value);
      }),
    );

  const listGrantRows = (userId: Option.Option<string>) =>
    Option.match(userId, {
      onNone: () => store.listGrants(),
      onSome: (value) => store.listGrantsByUser(value),
    });

  return {
    store,
    findCollection,

    ensureRootUser: (username, password) =>
      Effect.gen(function* () {
        const passwordHash = yield* hashHex(password);
        const existing = Option.getOrUndefined(yield* store.findUserByUsername(username));
        if (!existing) {
          yield* store.createUser({ id: randomId(), username, passwordHash, isSuperuser: true });
        } else if (existing.passwordHash !== passwordHash) {
          yield* store.updateUserPasswordHash(existing.id, passwordHash);
        }
      }),

    authenticateBasic: (username, password) =>
      Effect.gen(function* () {
        const user = Option.getOrUndefined(yield* store.findUserByUsername(username));
        if (!user || user.passwordHash !== (yield* hashHex(password))) {
          return yield* Effect.fail(unauthorized("Invalid credentials"));
        }
        return {
          userId: user.id,
          username: user.username,
          isSuperuser: user.isSuperuser,
        };
      }),

    authenticateDocumentToken: (token, collectionId, documentId, origin) =>
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis;
        const record = Option.getOrUndefined(yield* store.findTokenByHash(yield* hashHex(token)));
        if (
          !record ||
          record.collectionId !== collectionId ||
          record.documentId !== documentId ||
          Option.isSome(record.usedAt) ||
          record.expiresAtMs < now
        ) {
          return yield* Effect.fail(unauthorized("Invalid document token"));
        }
        if (
          Arr.isReadonlyArrayNonEmpty(record.origins) &&
          Option.isSome(origin) &&
          !record.origins.includes(origin.value)
        ) {
          return yield* Effect.fail(unauthorized("Document token origin is not allowed"));
        }
        yield* store.markTokenUsed(record.id, now);
        return { tokenId: record.id, permission: record.permission };
      }),

    createDatabase: (name, description) =>
      Effect.gen(function* () {
        const existing = Option.getOrUndefined(yield* store.findDatabaseByName(name));
        if (existing) return yield* Effect.fail(conflict(`Database '${name}' already exists`));
        const id = randomId();
        yield* store.createDatabase({ id, name, description });
        return { id, name, description };
      }),

    listDatabases: () =>
      store
        .listDatabases()
        .pipe(
          Effect.map((rows) =>
            rows.map((row) => ({ id: row.id, name: row.name, description: row.description })),
          ),
        ),

    deleteDatabase: (databaseId) =>
      Effect.gen(function* () {
        const record = Option.getOrUndefined(yield* store.findDatabaseById(databaseId));
        if (!record) return yield* Effect.fail(notFound(`Database not found: ${databaseId}`));
        if (registry.collections.some((entry) => entry.database === record.name)) {
          return yield* Effect.fail(
            conflict(`Database '${record.name}' is managed by the deployed migration registry`),
          );
        }
        yield* store.deleteDatabase(databaseId);
      }),

    createCollection: (databaseId, name, schemaInput) =>
      Effect.gen(function* () {
        const database = Option.getOrUndefined(yield* store.findDatabaseById(databaseId));
        if (!database) return yield* Effect.fail(notFound(`Database not found: ${databaseId}`));
        const existing = Option.getOrUndefined(yield* store.findCollectionByName(databaseId, name));
        if (existing) return yield* Effect.fail(conflict(`Collection '${name}' already exists`));
        const schema = normalizeSchemaObject(schemaInput);
        const id = randomId();
        yield* store.createCollection({
          id,
          databaseId,
          name,
          schemaJson: schema,
          schemaVersion: 1,
          migrationVersion: Option.none(),
        });
        yield* store.addSchemaVersion({
          collectionId: id,
          version: 1,
          schemaJson: schema,
          dataMigrationSource: Option.none(),
        });
        return { id, databaseId, name, schema, schemaVersion: 1, migrationVersion: Option.none() };
      }),

    listCollections: (databaseId) =>
      store
        .listCollectionsByDatabase(databaseId)
        .pipe(Effect.map((rows) => rows.map(toCollectionView))),

    deleteCollection: (collectionId) =>
      Effect.gen(function* () {
        const collection = yield* findCollection(collectionId);
        const database = Option.getOrUndefined(
          yield* store.findDatabaseById(collection.databaseId),
        );
        if (database && isRegistryCollection(registry, database.name, collection.name)) {
          return yield* Effect.fail(
            conflict(
              `Collection '${collection.name}' is managed by the deployed migration registry`,
            ),
          );
        }
        yield* store.deleteCollection(collectionId);
      }),

    createUser: (username, password) =>
      Effect.gen(function* () {
        const existing = Option.getOrUndefined(yield* store.findUserByUsername(username));
        if (existing) return yield* Effect.fail(conflict(`User '${username}' already exists`));
        const id = randomId();
        yield* store.createUser({
          id,
          username,
          passwordHash: yield* hashHex(password),
          isSuperuser: false,
        });
        return { id, username, isSuperuser: false };
      }),

    listUsers: () =>
      store.listUsers().pipe(
        Effect.map((rows) =>
          rows.map((row) => ({
            id: row.id,
            username: row.username,
            isSuperuser: row.isSuperuser,
          })),
        ),
      ),

    deleteUser: (userId) =>
      store.findUserById(userId).pipe(
        Effect.flatMap((user) => {
          if (Option.isNone(user)) return Effect.fail(notFound(`User not found: ${userId}`));
          return store.deleteUser(userId);
        }),
      ),

    grantPermission: (userId, databaseId, permission) =>
      Effect.gen(function* () {
        const user = yield* store.findUserById(userId);
        if (Option.isNone(user)) return yield* Effect.fail(notFound(`User not found: ${userId}`));
        const database = yield* store.findDatabaseById(databaseId);
        if (Option.isNone(database))
          return yield* Effect.fail(notFound(`Database not found: ${databaseId}`));
        yield* store.createGrant({ id: randomId(), userId, databaseId, permission });
      }),

    revokePermission: (userId, databaseId) =>
      store.findGrant(userId, databaseId).pipe(
        Effect.flatMap((grant) => {
          if (Option.isNone(grant)) {
            return Effect.fail(
              notFound(`Grant not found for user ${userId} on database ${databaseId}`),
            );
          }
          return store.removeGrant(userId, databaseId);
        }),
      ),

    listGrants: (userId) =>
      listGrantRows(userId).pipe(
        Effect.map((rows) =>
          rows.map((row) => ({
            id: row.id,
            userId: row.userId,
            databaseId: row.databaseId,
            permission: row.permission,
          })),
        ),
      ),

    createDocumentToken: (collectionId, documentId, permission, origins, expiresInSeconds) =>
      Effect.gen(function* () {
        yield* findCollection(collectionId);
        const index = Option.getOrUndefined(yield* store.findDocumentIndex(documentId));
        if (!index || index.collectionId !== collectionId || Option.isSome(index.deletedAt)) {
          return yield* Effect.fail(notFound(`Document not found: ${documentId}`));
        }
        const now = yield* Clock.currentTimeMillis;
        const token = randomId();
        yield* store.createToken({
          id: randomId(),
          tokenHash: yield* hashHex(token),
          collectionId,
          documentId,
          permission,
          origins,
          expiresAtMs: now + Option.getOrElse(expiresInSeconds, () => 300) * 1000,
          usedAt: Option.none(),
        });
        return { token };
      }),

    ensureDatabasePermission: (userId, isSuperuser, databaseId, required) =>
      Effect.gen(function* () {
        const database = yield* store.findDatabaseById(databaseId);
        if (Option.isNone(database))
          return yield* Effect.fail(notFound(`Database not found: ${databaseId}`));
        if (isSuperuser) return;
        const grant = yield* store.findGrant(userId, databaseId);
        if (
          Option.isNone(grant) ||
          permissionRank(grant.value.permission) < permissionRank(required)
        ) {
          return yield* Effect.fail(
            forbidden(`Permission '${required}' required on database ${databaseId}`),
          );
        }
      }),

    databaseIdForCollection: (collectionId) =>
      findCollection(collectionId).pipe(Effect.map((collection) => collection.databaseId)),

    prepareDocument: (collectionId, id, value, isMaterialized) =>
      Effect.gen(function* () {
        const collection = yield* findCollection(collectionId);
        const documentId = Option.getOrElse(id, randomId);
        const existing = Option.getOrUndefined(yield* store.findDocumentIndex(documentId));
        if (existing && Option.isNone(existing.deletedAt)) {
          if (existing.collectionId === collectionId) {
            // A live index row under the SAME collection is a real conflict
            // only while the document object actually holds state. The index
            // row is just a pointer: `deleteCollection` (and other out-of-band
            // state loss) can strip a document object's storage while leaving
            // its index row live and same-collection — a half-dead entry that
            // reserves the id forever (create conflicts, get reports NotFound).
            // When the caller can prove the object is unmaterialized, re-seed
            // it (fall through to registerDocument, which the caller pairs with
            // a fresh document-object create) instead of conflicting.
            if (Option.isNone(isMaterialized)) {
              return yield* Effect.fail(conflict(`Document '${documentId}' already exists`));
            }
            const materialized = yield* isMaterialized.value(documentId);
            if (materialized) {
              return yield* Effect.fail(conflict(`Document '${documentId}' already exists`));
            }
          } else {
            // A live index row under ANOTHER collection is a real conflict
            // only while that collection still exists. `deleteCollection` does
            // not sweep its documents' index rows, so a row can outlive its
            // collection — such an orphan is unreachable by every read path
            // (they all match on collectionId) yet would reserve the id
            // forever: create conflicts, get reports NotFound. Re-register it
            // instead (INSERT OR REPLACE re-points the row and clears
            // deleted_at); the document object is addressed per collection, so
            // the new document starts from fresh state.
            const owner = yield* store.findCollectionById(existing.collectionId);
            if (Option.isSome(owner)) {
              return yield* Effect.fail(conflict(`Document '${documentId}' already exists`));
            }
          }
        }
        const sanitized = sanitizeValueForSchema(collection.schemaJson, value);
        yield* store.registerDocument(documentId, collectionId);
        return {
          documentId,
          value: sanitized,
          schemaVersion: collection.schemaVersion,
          migrationVersion: collection.migrationVersion,
        };
      }),

    findDocument: (collectionId, documentId) =>
      store.findDocumentIndex(documentId).pipe(
        Effect.flatMap((index) => {
          if (
            Option.isSome(index) &&
            index.value.collectionId === collectionId &&
            Option.isNone(index.value.deletedAt)
          ) {
            return Effect.void;
          }
          return Effect.fail(notFound(`Document not found: ${documentId}`));
        }),
      ),

    listDocumentIds: (collectionId) =>
      findCollection(collectionId).pipe(
        Effect.flatMap(() => store.listDocumentsByCollection(collectionId)),
        Effect.map((rows) => rows.map((row) => row.documentId)),
      ),

    markDocumentDeleted: (documentId) =>
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis;
        yield* store.markDocumentDeleted(documentId, now);
      }),
  };
};
