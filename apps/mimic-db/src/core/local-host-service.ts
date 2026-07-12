import { DurableEntityHost, makeDurableEntityAddress } from "@voidhash/platform/DurableEntity";
import { Effect, Layer } from "effect";

import { HostServiceTag, type HostService, type PresenceEntry } from "../app/hostService.ts";
import { getConfig, type MimicConfig } from "../config.ts";
import { makeControlEngine, type ControlEngineApi } from "./control-engine.ts";
import { makeDocumentEngine, type DocumentEngineApi } from "./document-engine.ts";
import {
  DocumentStoreFactory,
  MemoryDocumentStoreFactoryLive,
  type DocumentStoreFactoryShape,
} from "./document-store-factory.ts";
import { MemoryControlStoreLive } from "./memory-store.ts";
import {
  LocalMigrationExecutorLive,
  MigrationExecutor,
  type MigrationExecutorApi,
} from "./migration-executor.ts";
import { makeControlStoreSchemaProvider } from "./schema-provider.ts";
import { ControlStore } from "./store.ts";
import { MemoryDurableEntityHostLive } from "./local-entity-host.ts";
import { randomId } from "./ids.ts";

const docKeyOf = (collectionId: string, documentId: string): string =>
  `${collectionId}:${documentId}`;

export interface LocalHostServiceDeps {
  readonly control: ControlEngineApi;
  readonly entities: DurableEntityHost["Service"];
  readonly executor: MigrationExecutorApi;
  readonly documentStores: DocumentStoreFactoryShape;
  readonly config: MimicConfig;
}

/**
 * In-process `HostService` used for `pnpm dev` (standalone) and the integration
 * tests. Control state lives in one serialized entity; each document gets its
 * own serialized `DocumentEngine` over a runtime-selected persistence store.
 */
export const makeLocalHostService = (deps: LocalHostServiceDeps): HostService => {
  const { control, entities, executor, documentStores, config } = deps;
  const schema = makeControlStoreSchemaProvider(control.store);
  const documents = new Map<string, DocumentEngineApi>();
  const presence = new Map<string, Map<string, PresenceEntry>>();

  const getDoc = (collectionId: string, documentId: string): DocumentEngineApi => {
    const key = docKeyOf(collectionId, documentId);
    let engine = documents.get(key);
    if (!engine) {
      engine = makeDocumentEngine({
        store: documentStores.make(collectionId, documentId),
        executor,
        schema,
        snapshotEveryCommands: config.snapshotEveryCommands,
      });
      documents.set(key, engine);
    }
    return engine;
  };

  const presenceOf = (collectionId: string, documentId: string): Map<string, PresenceEntry> => {
    const key = docKeyOf(collectionId, documentId);
    let entries = presence.get(key);
    if (!entries) {
      entries = new Map();
      presence.set(key, entries);
    }
    return entries;
  };

  const presenceSnapshot = (
    collectionId: string,
    documentId: string,
  ): Record<string, PresenceEntry> => Object.fromEntries(presenceOf(collectionId, documentId));

  const runControl = <A, E, R>(operation: () => Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
    entities.run(makeDurableEntityAddress("mimic-control", "default"), () =>
      Effect.suspend(operation),
    );

  const runDocument = <A, E, R>(
    collectionId: string,
    documentId: string,
    operation: () => Effect.Effect<A, E, R>,
  ): Effect.Effect<A, E, R> =>
    entities.run(
      makeDurableEntityAddress("mimic-document", docKeyOf(collectionId, documentId)),
      () => Effect.suspend(operation),
    );

  return {
    authenticateBasic: (username, password) =>
      runControl(() => control.authenticateBasic(username, password)),
    authenticateDocumentToken: (token, collectionId, documentId, origin) =>
      runControl(() => control.authenticateDocumentToken(token, collectionId, documentId, origin)),
    createDatabase: (name, description) =>
      runControl(() => control.createDatabase(name, description)),
    listDatabases: () => runControl(control.listDatabases),
    deleteDatabase: (databaseId) => runControl(() => control.deleteDatabase(databaseId)),
    createCollection: (databaseId, name, schemaInput) =>
      runControl(() => control.createCollection(databaseId, name, schemaInput)),
    listCollections: (databaseId) => runControl(() => control.listCollections(databaseId)),
    updateCollectionSchema: (collectionId, schemaInput) =>
      runControl(() => control.updateCollectionSchema(collectionId, schemaInput)),
    deleteCollection: (collectionId) => runControl(() => control.deleteCollection(collectionId)),
    listMigrations: (databaseId) => runControl(() => control.listMigrations(databaseId)),
    applyMigration: (databaseId, version, name, checksum, changes, options) =>
      runControl(() =>
        control.applyMigration(databaseId, version, name, checksum, changes, "apply", options),
      ),
    rerunMigration: (databaseId, version, name, checksum, changes, options) =>
      runControl(() =>
        control.applyMigration(databaseId, version, name, checksum, changes, "rerun", options),
      ),
    replaceMigration: (databaseId, version, name, checksum, changes, options) =>
      runControl(() =>
        control.applyMigration(databaseId, version, name, checksum, changes, "replace", options),
      ),
    getMigrationStatus: (databaseId, version) =>
      runControl(() => control.getMigrationStatus(databaseId, version)),
    createUser: (username, password) => runControl(() => control.createUser(username, password)),
    listUsers: () => runControl(control.listUsers),
    deleteUser: (userId) => runControl(() => control.deleteUser(userId)),
    grantPermission: (userId, databaseId, permission) =>
      runControl(() => control.grantPermission(userId, databaseId, permission)),
    revokePermission: (userId, databaseId) =>
      runControl(() => control.revokePermission(userId, databaseId)),
    listGrants: (userId) => runControl(() => control.listGrants(userId)),
    createDocumentAuthToken: (collectionId, documentId, permission, origins, expiresInSeconds) =>
      runControl(() =>
        control.createDocumentToken(
          collectionId,
          documentId,
          permission,
          origins,
          expiresInSeconds,
        ),
      ),
    ensureDatabasePermission: (userId, isSuperuser, databaseId, required) =>
      runControl(() => control.ensureDatabasePermission(userId, isSuperuser, databaseId, required)),
    databaseIdForCollection: (collectionId) =>
      runControl(() => control.databaseIdForCollection(collectionId)),

    createDocument: (collectionId, id, value) =>
      Effect.suspend(() => {
        const documentId = id ?? randomId();
        return runDocument(collectionId, documentId, () =>
          Effect.gen(function* () {
            // Probe the per-document engine so prepareDocument can heal a half-dead
            // index row (live + same-collection, but the document engine holds no
            // state) instead of conflicting forever — see prepareDocument.
            const prepared = yield* runControl(() =>
              control.prepareDocument(collectionId, documentId, value, (preparedId) =>
                getDoc(collectionId, preparedId)
                  .load()
                  .pipe(
                    Effect.as(true),
                    Effect.catchTag("NotFoundError", () => Effect.succeed(false)),
                    Effect.catchTag("MigrationFailedError", () => Effect.succeed(true)),
                  ),
              ),
            );
            yield* getDoc(collectionId, prepared.documentId).create(
              collectionId,
              prepared.value,
              prepared.schemaVersion,
            );
            return {
              id: prepared.documentId,
              collectionId,
              value: prepared.value,
              version: 1,
            };
          }),
        );
      }),

    getDocument: (collectionId, documentId) =>
      runDocument(collectionId, documentId, () =>
        Effect.gen(function* () {
          yield* runControl(() => control.findDocument(collectionId, documentId));
          const loaded = yield* getDoc(collectionId, documentId).load();
          return { id: documentId, collectionId, value: loaded.value, version: loaded.version };
        }),
      ),

    listDocuments: (collectionId) =>
      Effect.gen(function* () {
        const ids = yield* runControl(() => control.listDocumentIds(collectionId));
        return yield* Effect.forEach(ids, (documentId) =>
          runDocument(collectionId, documentId, () =>
            getDoc(collectionId, documentId)
              .load()
              .pipe(
                Effect.map(
                  (loaded) =>
                    ({
                      id: documentId,
                      collectionId,
                      value: loaded.value,
                      version: loaded.version,
                    }) as const,
                ),
              ),
          ),
        );
      }),

    deleteDocument: (collectionId, documentId) =>
      runDocument(collectionId, documentId, () =>
        Effect.gen(function* () {
          yield* runControl(() =>
            Effect.gen(function* () {
              yield* control.findDocument(collectionId, documentId);
              yield* control.markDocumentDeleted(documentId);
            }),
          );
          yield* getDoc(collectionId, documentId).remove();
        }),
      ),

    submitTransaction: (collectionId, documentId, transaction) =>
      runDocument(collectionId, documentId, () =>
        Effect.gen(function* () {
          yield* runControl(() => control.findDocument(collectionId, documentId));
          return yield* getDoc(collectionId, documentId).submit(transaction);
        }),
      ),

    attachConnection: (collectionId, documentId) =>
      runDocument(collectionId, documentId, () =>
        Effect.gen(function* () {
          yield* runControl(() => control.findDocument(collectionId, documentId));
          const loaded = yield* getDoc(collectionId, documentId).load();
          return {
            value: loaded.value,
            version: loaded.version,
            presences: presenceSnapshot(collectionId, documentId),
          };
        }),
      ),

    heartbeatConnection: (collectionId, documentId) =>
      runDocument(collectionId, documentId, () => Effect.void),
    detachConnection: (collectionId, documentId, connectionId) =>
      runDocument(collectionId, documentId, () =>
        Effect.sync(() => void presenceOf(collectionId, documentId).delete(connectionId)),
      ),

    getPresenceSnapshot: (collectionId, documentId) =>
      runDocument(collectionId, documentId, () =>
        Effect.sync(() => ({ presences: presenceSnapshot(collectionId, documentId) })),
      ),
    setPresence: (collectionId, documentId, connectionId, entry) =>
      runDocument(collectionId, documentId, () =>
        Effect.sync(() => void presenceOf(collectionId, documentId).set(connectionId, entry)),
      ),
    removePresence: (collectionId, documentId, connectionId) =>
      runDocument(collectionId, documentId, () =>
        Effect.sync(() => void presenceOf(collectionId, documentId).delete(connectionId)),
      ),
  };
};

/**
 * Builds `HostService` from a `ControlStore` + `MigrationExecutor` in context
 * and bootstraps the root user. Defaults below provide the in-memory backend.
 */
export const LocalHostServiceLive = Layer.effect(
  HostServiceTag,
  Effect.gen(function* () {
    const controlStore = yield* ControlStore;
    const entities = yield* DurableEntityHost;
    const executor = yield* MigrationExecutor;
    const documentStores = yield* DocumentStoreFactory;
    const config = getConfig();
    const control = makeControlEngine(controlStore);
    yield* entities.run(makeDurableEntityAddress("mimic-control", "default"), () =>
      control.ensureRootUser(config.rootUsername, config.rootPassword),
    );
    return makeLocalHostService({ control, entities, executor, documentStores, config });
  }),
);

/** In-memory default composition for dev + tests. */
export const LocalHostServiceDefault = LocalHostServiceLive.pipe(
  Layer.provide(MemoryControlStoreLive),
  Layer.provide(LocalMigrationExecutorLive),
  Layer.provide(MemoryDurableEntityHostLive),
  Layer.provide(MemoryDocumentStoreFactoryLive),
);
