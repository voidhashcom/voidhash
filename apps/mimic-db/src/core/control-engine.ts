import type { SchemaObject, Value } from "@voidhash/mimic-core";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  type DatabasePermission,
  type DocumentPermission,
  type MigrationRunReport,
  type MigrationStatus,
} from "@voidhash/mimic-server/rpc";
import { Effect } from "effect";

import type { ApplyMigrationOptions, MigrationChange } from "../app/hostService.ts";
import { normalizeSchemaObject, sanitizeValueForSchema } from "../document/schema.ts";
import { hashHex, randomId } from "./ids.ts";
import type { CollectionRecord, ControlStoreApi, MigrationState } from "./store.ts";

const notFound = (message: string): NotFoundError =>
  new NotFoundError({ code: "not_found", message });
const conflict = (message: string): ConflictError =>
  new ConflictError({ code: "conflict", message });
const unauthorized = (message: string): UnauthorizedError =>
  new UnauthorizedError({ code: "unauthorized", message });
const forbidden = (message: string): ForbiddenError =>
  new ForbiddenError({ code: "forbidden", message });

const permissionRank = (permission: DatabasePermission): number =>
  permission === "read" ? 1 : permission === "write" ? 2 : 3;

interface CollectionView {
  readonly id: string;
  readonly databaseId: string;
  readonly name: string;
  readonly schema: SchemaObject;
  readonly schemaVersion: number;
}

const toCollectionView = (record: CollectionRecord): CollectionView => ({
  id: record.id,
  databaseId: record.databaseId,
  name: record.name,
  schema: record.schemaJson,
  schemaVersion: record.schemaVersion,
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
    origin: string | null,
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
  readonly deleteDatabase: (databaseId: string) => Effect.Effect<void, NotFoundError>;
  readonly createCollection: (
    databaseId: string,
    name: string,
    schemaInput: unknown,
  ) => Effect.Effect<CollectionView, NotFoundError | ConflictError>;
  readonly listCollections: (databaseId: string) => Effect.Effect<readonly CollectionView[]>;
  readonly updateCollectionSchema: (
    collectionId: string,
    schemaInput: unknown,
  ) => Effect.Effect<CollectionView, NotFoundError>;
  readonly deleteCollection: (collectionId: string) => Effect.Effect<void, NotFoundError>;
  readonly listMigrations: (databaseId: string) => Effect.Effect<
    readonly {
      readonly databaseId: string;
      readonly version: number;
      readonly name: string;
      readonly checksum: string;
      readonly appliedAt: string;
      readonly state: MigrationState;
      readonly totalDocuments: number;
      readonly succeededDocuments: number;
      readonly failedDocuments: number;
      readonly changes?: readonly MigrationChange[];
    }[]
  >;
  readonly applyMigration: (
    databaseId: string,
    version: number,
    name: string,
    checksum: string,
    changes: readonly MigrationChange[],
    mode: "apply" | "rerun" | "replace",
    options?: ApplyMigrationOptions,
  ) => Effect.Effect<MigrationRunReport, NotFoundError | ConflictError>;
  readonly getMigrationStatus: (
    databaseId: string,
    version: number,
  ) => Effect.Effect<MigrationStatus>;
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
  readonly listGrants: (userId?: string) => Effect.Effect<
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
    expiresInSeconds: number | undefined,
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
    id: string | undefined,
    value: unknown,
    isMaterialized?: (documentId: string) => Effect.Effect<boolean>,
  ) => Effect.Effect<
    { readonly documentId: string; readonly value: Value; readonly schemaVersion: number },
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
 * Migrations follow the lazy model: `applyMigration` publishes the new schema
 * version(s) and records the migration; documents migrate themselves on load
 * (see `document-engine.ts`). There is no eager per-document "push" here.
 */
export const makeControlEngine = (store: ControlStoreApi): ControlEngineApi => {
  const findCollection: ControlEngineApi["findCollection"] = (collectionId) =>
    store
      .findCollectionById(collectionId)
      .pipe(
        Effect.flatMap((record) =>
          record
            ? Effect.succeed(record)
            : Effect.fail(notFound(`Collection not found: ${collectionId}`)),
        ),
      );

  const findCollectionByName = (databaseId: string, name: string) =>
    store.findCollectionByName(databaseId, name);

  const applySingleChange = (databaseId: string, change: MigrationChange) =>
    Effect.gen(function* () {
      const schema = normalizeSchemaObject(change.schema);
      const existing = yield* findCollectionByName(databaseId, change.collection);
      if (change.type === "create") {
        if (existing) {
          if (change.skipIfExists) return;
          return yield* Effect.fail(conflict(`Collection '${change.collection}' already exists`));
        }
        const id = randomId();
        yield* store.createCollection({
          id,
          databaseId,
          name: change.collection,
          schemaJson: schema,
          schemaVersion: 1,
        });
        yield* store.addSchemaVersion({
          collectionId: id,
          version: 1,
          schemaJson: schema,
          dataMigrationSource: null,
        });
        return;
      }
      // update
      if (!existing) {
        return yield* Effect.fail(notFound(`Collection not found: ${change.collection}`));
      }
      const nextVersion = existing.schemaVersion + 1;
      yield* store.updateCollectionSchema(existing.id, schema, nextVersion);
      yield* store.addSchemaVersion({
        collectionId: existing.id,
        version: nextVersion,
        schemaJson: schema,
        dataMigrationSource: change.dataMigrationSource ?? null,
      });
    });

  return {
    store,
    findCollection,

    ensureRootUser: (username, password) =>
      Effect.gen(function* () {
        const passwordHash = hashHex(password);
        const existing = yield* store.findUserByUsername(username);
        if (!existing) {
          yield* store.createUser({ id: randomId(), username, passwordHash, isSuperuser: true });
        } else if (existing.passwordHash !== passwordHash) {
          yield* store.updateUserPasswordHash(existing.id, passwordHash);
        }
      }),

    authenticateBasic: (username, password) =>
      store.findUserByUsername(username).pipe(
        Effect.flatMap((user) =>
          !user || user.passwordHash !== hashHex(password)
            ? Effect.fail(unauthorized("Invalid credentials"))
            : Effect.succeed({
                userId: user.id,
                username: user.username,
                isSuperuser: user.isSuperuser,
              }),
        ),
      ),

    authenticateDocumentToken: (token, collectionId, documentId, origin) =>
      Effect.gen(function* () {
        const record = yield* store.findTokenByHash(hashHex(token));
        if (
          !record ||
          record.collectionId !== collectionId ||
          record.documentId !== documentId ||
          record.usedAt !== null ||
          record.expiresAtMs < Date.now()
        ) {
          return yield* Effect.fail(unauthorized("Invalid document token"));
        }
        if (record.origins.length > 0 && origin !== null && !record.origins.includes(origin)) {
          return yield* Effect.fail(unauthorized("Document token origin is not allowed"));
        }
        yield* store.markTokenUsed(record.id, Date.now());
        return { tokenId: record.id, permission: record.permission };
      }),

    createDatabase: (name, description) =>
      Effect.gen(function* () {
        const existing = yield* store.findDatabaseByName(name);
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
      store
        .findDatabaseById(databaseId)
        .pipe(
          Effect.flatMap((record) =>
            record
              ? store.deleteDatabase(databaseId)
              : Effect.fail(notFound(`Database not found: ${databaseId}`)),
          ),
        ),

    createCollection: (databaseId, name, schemaInput) =>
      Effect.gen(function* () {
        const database = yield* store.findDatabaseById(databaseId);
        if (!database) return yield* Effect.fail(notFound(`Database not found: ${databaseId}`));
        const existing = yield* store.findCollectionByName(databaseId, name);
        if (existing) return yield* Effect.fail(conflict(`Collection '${name}' already exists`));
        const schema = normalizeSchemaObject(schemaInput);
        const id = randomId();
        yield* store.createCollection({
          id,
          databaseId,
          name,
          schemaJson: schema,
          schemaVersion: 1,
        });
        yield* store.addSchemaVersion({
          collectionId: id,
          version: 1,
          schemaJson: schema,
          dataMigrationSource: null,
        });
        return { id, databaseId, name, schema, schemaVersion: 1 };
      }),

    listCollections: (databaseId) =>
      store
        .listCollectionsByDatabase(databaseId)
        .pipe(Effect.map((rows) => rows.map(toCollectionView))),

    updateCollectionSchema: (collectionId, schemaInput) =>
      Effect.gen(function* () {
        const collection = yield* findCollection(collectionId);
        const schema = normalizeSchemaObject(schemaInput);
        const nextVersion = collection.schemaVersion + 1;
        yield* store.updateCollectionSchema(collectionId, schema, nextVersion);
        yield* store.addSchemaVersion({
          collectionId,
          version: nextVersion,
          schemaJson: schema,
          dataMigrationSource: null,
        });
        return { ...toCollectionView(collection), schema, schemaVersion: nextVersion };
      }),

    deleteCollection: (collectionId) =>
      findCollection(collectionId).pipe(Effect.flatMap(() => store.deleteCollection(collectionId))),

    listMigrations: (databaseId) =>
      store.listMigrations(databaseId).pipe(
        Effect.map((rows) =>
          rows.map((row) => ({
            databaseId: row.databaseId,
            version: row.version,
            name: row.name,
            checksum: row.checksum,
            appliedAt: new Date(row.appliedAtMs).toISOString(),
            state: row.state,
            totalDocuments: row.totalDocuments,
            succeededDocuments: row.succeededDocuments,
            failedDocuments: row.failedDocuments,
            changes: (row.changesJson ?? undefined) as readonly MigrationChange[] | undefined,
          })),
        ),
      ),

    applyMigration: (databaseId, version, name, checksum, changes, mode, options) =>
      Effect.gen(function* () {
        const database = yield* store.findDatabaseById(databaseId);
        if (!database) return yield* Effect.fail(notFound(`Database not found: ${databaseId}`));

        const isDryRun = options?.dryRun !== undefined && options?.dryRun !== false;
        const existing = yield* store.findMigration(databaseId, version);

        if (mode === "apply" && existing && existing.checksum === checksum) {
          // Idempotent re-apply of an identical migration.
          return {
            databaseId,
            version,
            state: "succeeded",
            succeeded: 0,
            failed: 0,
            skipped: 0,
            perDocument: [],
            dryRun: isDryRun,
          };
        }
        if (mode === "apply" && existing && existing.checksum !== checksum) {
          return yield* Effect.fail(
            conflict(`Migration version ${version} already applied with a different checksum`),
          );
        }

        if (!isDryRun) {
          for (const change of changes) {
            yield* applySingleChange(databaseId, change);
          }
          yield* store.upsertMigration({
            databaseId,
            version,
            name,
            checksum,
            appliedAtMs: Date.now(),
            state: "succeeded",
            totalDocuments: 0,
            succeededDocuments: 0,
            failedDocuments: 0,
            changesJson: changes as readonly unknown[],
          });
        }

        return {
          databaseId,
          version,
          state: "succeeded",
          succeeded: 0,
          failed: 0,
          skipped: 0,
          perDocument: [],
          dryRun: isDryRun,
        };
      }),

    getMigrationStatus: (databaseId, version) =>
      store.findMigration(databaseId, version).pipe(
        Effect.map((record) => ({
          databaseId,
          version,
          state: (record?.state ?? "unknown") as MigrationStatus["state"],
          ...(record ? { checksum: record.checksum } : {}),
          summary: {
            pending: 0,
            running: 0,
            succeeded: record?.succeededDocuments ?? 0,
            failed: record?.failedDocuments ?? 0,
            skipped: 0,
          },
          failures: [],
        })),
      ),

    createUser: (username, password) =>
      Effect.gen(function* () {
        const existing = yield* store.findUserByUsername(username);
        if (existing) return yield* Effect.fail(conflict(`User '${username}' already exists`));
        const id = randomId();
        yield* store.createUser({
          id,
          username,
          passwordHash: hashHex(password),
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
      store
        .findUserById(userId)
        .pipe(
          Effect.flatMap((user) =>
            user ? store.deleteUser(userId) : Effect.fail(notFound(`User not found: ${userId}`)),
          ),
        ),

    grantPermission: (userId, databaseId, permission) =>
      Effect.gen(function* () {
        const user = yield* store.findUserById(userId);
        if (!user) return yield* Effect.fail(notFound(`User not found: ${userId}`));
        const database = yield* store.findDatabaseById(databaseId);
        if (!database) return yield* Effect.fail(notFound(`Database not found: ${databaseId}`));
        yield* store.createGrant({ id: randomId(), userId, databaseId, permission });
      }),

    revokePermission: (userId, databaseId) =>
      store
        .findGrant(userId, databaseId)
        .pipe(
          Effect.flatMap((grant) =>
            grant
              ? store.removeGrant(userId, databaseId)
              : Effect.fail(
                  notFound(`Grant not found for user ${userId} on database ${databaseId}`),
                ),
          ),
        ),

    listGrants: (userId) =>
      (userId ? store.listGrantsByUser(userId) : store.listGrants()).pipe(
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
        const index = yield* store.findDocumentIndex(documentId);
        if (!index || index.collectionId !== collectionId || index.deletedAt !== null) {
          return yield* Effect.fail(notFound(`Document not found: ${documentId}`));
        }
        const token = randomId();
        yield* store.createToken({
          id: randomId(),
          tokenHash: hashHex(token),
          collectionId,
          documentId,
          permission,
          origins,
          expiresAtMs: Date.now() + (expiresInSeconds ?? 300) * 1000,
          usedAt: null,
        });
        return { token };
      }),

    ensureDatabasePermission: (userId, isSuperuser, databaseId, required) =>
      Effect.gen(function* () {
        const database = yield* store.findDatabaseById(databaseId);
        if (!database) return yield* Effect.fail(notFound(`Database not found: ${databaseId}`));
        if (isSuperuser) return;
        const grant = yield* store.findGrant(userId, databaseId);
        if (!grant || permissionRank(grant.permission) < permissionRank(required)) {
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
        const documentId = id ?? randomId();
        const existing = yield* store.findDocumentIndex(documentId);
        if (existing && existing.deletedAt === null) {
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
            const materialized =
              isMaterialized === undefined ? true : yield* isMaterialized(documentId);
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
            if (owner !== undefined) {
              return yield* Effect.fail(conflict(`Document '${documentId}' already exists`));
            }
          }
        }
        const sanitized = sanitizeValueForSchema(collection.schemaJson, value);
        yield* store.registerDocument(documentId, collectionId);
        return { documentId, value: sanitized, schemaVersion: collection.schemaVersion };
      }),

    findDocument: (collectionId, documentId) =>
      store
        .findDocumentIndex(documentId)
        .pipe(
          Effect.flatMap((index) =>
            index && index.collectionId === collectionId && index.deletedAt === null
              ? Effect.void
              : Effect.fail(notFound(`Document not found: ${documentId}`)),
          ),
        ),

    listDocumentIds: (collectionId) =>
      findCollection(collectionId).pipe(
        Effect.flatMap(() => store.listDocumentsByCollection(collectionId)),
        Effect.map((rows) => rows.map((row) => row.documentId)),
      ),

    markDocumentDeleted: (documentId) => store.markDocumentDeleted(documentId, Date.now()),
  };
};
