import {
  type DurableEntityContext,
  DurableEntityHost,
  makeDurableEntityAddress,
} from "@orbian/sdk/DurableEntity";
import { Effect, Layer } from "effect";
import type { MigrationRegistry } from "@voidhash/mimic-server/migrate";
import { NotFoundError } from "@voidhash/mimic-server/rpc";

import { HostServiceTag, type HostService, type PresenceEntry } from "../app/hostService.ts";
import { getConfig, type MimicConfig } from "../config.ts";
import type { TransactionEnvelope } from "../document/transaction.ts";
import type { SessionAttachment } from "../ws/document-session.ts";
import { IDLE_DIRTY_SEQ_KEY } from "../ws/idle-notify.ts";
import {
  presenceRemoveMessage,
  presenceUpdateMessage,
  transactionMessage,
} from "../ws/messages.ts";
import { encodeServerMessage, type ServerMessage } from "../ws/protocol.ts";
import { makeControlEngine, type ControlEngineApi } from "./control-engine.ts";
import { makeDocumentEngine, type DocumentEngineApi } from "./document-engine.ts";
import {
  DocumentStoreFactory,
  MemoryDocumentStoreFactoryLive,
  type DocumentStoreFactoryShape,
} from "./document-store-factory.ts";
import { MemoryControlStoreLive } from "./memory-store.ts";
import {
  EmptyMigrationRegistryLive,
  ensureMigrationRegistry,
  MigrationRegistryService,
} from "./migration-registry.ts";
import { makeControlStoreSchemaProvider } from "./schema-provider.ts";
import { ControlStore } from "./store.ts";
import { MemoryDurableEntityHostLive } from "./local-entity-host.ts";
import { randomId } from "./ids.ts";

const docKeyOf = (collectionId: string, documentId: string): string =>
  `${collectionId}:${documentId}`;

interface StoredPresence {
  readonly entry: PresenceEntry;
  readonly expiresAt?: number;
}

export interface LocalHostServiceDeps {
  readonly control: ControlEngineApi;
  readonly entities: DurableEntityHost["Service"];
  readonly migrations: MigrationRegistry;
  readonly documentStores: DocumentStoreFactoryShape;
  readonly config: MimicConfig;
}

/**
 * In-process `HostService` used for `pnpm dev` (standalone) and the integration
 * tests. Control state lives in one serialized entity; each document gets its
 * own serialized `DocumentEngine` over a runtime-selected persistence store.
 */
export const makeLocalHostService = (deps: LocalHostServiceDeps): HostService => {
  const { control, entities, migrations, documentStores, config } = deps;
  const schema = makeControlStoreSchemaProvider(control.store);
  const documents = new Map<string, DocumentEngineApi>();
  const presence = new Map<string, Map<string, StoredPresence>>();

  const getDoc = (collectionId: string, documentId: string): DocumentEngineApi => {
    const key = docKeyOf(collectionId, documentId);
    let engine = documents.get(key);
    if (!engine) {
      engine = makeDocumentEngine({
        store: documentStores.make(collectionId, documentId),
        migrations,
        schema,
        snapshotEveryCommands: config.snapshotEveryCommands,
      });
      documents.set(key, engine);
    }
    return engine;
  };

  const presenceOf = (collectionId: string, documentId: string): Map<string, StoredPresence> => {
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
  ): Record<string, PresenceEntry> =>
    Object.fromEntries(
      [...presenceOf(collectionId, documentId)].map(([connectionId, stored]) => [
        connectionId,
        stored.entry,
      ]),
    );

  const runControl = <A, E, R>(operation: () => Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
    entities.run(makeDurableEntityAddress("mimic-control", "default"), () =>
      Effect.suspend(operation),
    );

  const runDocument = <A, E, R>(
    collectionId: string,
    documentId: string,
    operation: (entity: DurableEntityContext) => Effect.Effect<A, E, R>,
  ): Effect.Effect<A, E, R> =>
    entities.run(
      makeDurableEntityAddress("mimic-document", docKeyOf(collectionId, documentId)),
      (entity) => Effect.suspend(() => operation(entity)),
    );

  const connectionNotFound = (connectionId: string) =>
    new NotFoundError({ code: "not_found", message: `Connection not found: ${connectionId}` });

  const broadcast = (entity: DurableEntityContext, message: ServerMessage): Effect.Effect<void> =>
    Effect.gen(function* () {
      const sessions = yield* entity.sessions.list;
      yield* Effect.forEach(
        sessions,
        (session) =>
          Effect.gen(function* () {
            const attachment = (yield* session.getAttachment) as SessionAttachment | undefined;
            if (attachment?.authenticated !== true) return;
            yield* session.send(encodeServerMessage(message));
          }),
        { discard: true },
      );
    });

  const scheduleAlarmAt = (entity: DurableEntityContext, scheduledTime: number) =>
    Effect.gen(function* () {
      const current = yield* entity.alarm.get;
      if (current === undefined || scheduledTime < current) {
        yield* entity.alarm.set(scheduledTime);
      }
    });

  const scheduleNextPresenceExpiry = (
    entries: Map<string, StoredPresence>,
    entity: DurableEntityContext,
  ) => {
    const expirations = [...entries.values()].flatMap(({ expiresAt }) =>
      expiresAt === undefined ? [] : [expiresAt],
    );
    return expirations.length === 0
      ? Effect.void
      : scheduleAlarmAt(entity, Math.min(...expirations));
  };

  const prunePresence = (
    collectionId: string,
    documentId: string,
    entity: DurableEntityContext,
  ): Effect.Effect<void> =>
    Effect.gen(function* () {
      const entries = presenceOf(collectionId, documentId);
      const now = Date.now();
      for (const [connectionId, stored] of entries) {
        if (stored.expiresAt === undefined || stored.expiresAt > now) continue;
        entries.delete(connectionId);
        yield* broadcast(entity, presenceRemoveMessage(connectionId));
      }
      yield* scheduleNextPresenceExpiry(entries, entity);
    });

  const requireHeadlessConnection = (
    collectionId: string,
    documentId: string,
    connectionId: string,
    leaseMs: number,
    entity: DurableEntityContext,
  ): Effect.Effect<StoredPresence, NotFoundError> =>
    Effect.gen(function* () {
      yield* prunePresence(collectionId, documentId, entity);
      const entries = presenceOf(collectionId, documentId);
      const current = entries.get(connectionId);
      if (current?.expiresAt === undefined) {
        return yield* Effect.fail(connectionNotFound(connectionId));
      }
      const next = { ...current, expiresAt: Date.now() + leaseMs };
      entries.set(connectionId, next);
      yield* scheduleAlarmAt(entity, next.expiresAt);
      return next;
    });

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
    deleteCollection: (collectionId) => runControl(() => control.deleteCollection(collectionId)),
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
              prepared.migrationVersion,
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

    attachConnection: (
      collectionId,
      documentId,
      connectionId,
      _permission,
      userId,
      connectionPresence,
      leaseMs = config.presenceTtlMs,
    ) =>
      runDocument(collectionId, documentId, (entity) =>
        Effect.gen(function* () {
          yield* runControl(() => control.findDocument(collectionId, documentId));
          if (connectionPresence === undefined) {
            return yield* Effect.fail(
              new NotFoundError({
                code: "not_found",
                message: "Headless connections require presence data",
              }),
            );
          }
          yield* prunePresence(collectionId, documentId, entity);
          const loaded = yield* getDoc(collectionId, documentId).load();
          const entry: PresenceEntry = {
            data: connectionPresence,
            ...(userId === undefined ? {} : { userId }),
          };
          const stored = {
            entry,
            expiresAt: Date.now() + leaseMs,
          };
          presenceOf(collectionId, documentId).set(connectionId, stored);
          yield* scheduleAlarmAt(entity, stored.expiresAt);
          yield* broadcast(entity, presenceUpdateMessage(connectionId, entry.data, entry.userId));
          return {
            value: loaded.value,
            version: loaded.version,
            presences: presenceSnapshot(collectionId, documentId),
          };
        }),
      ),

    heartbeatConnection: (collectionId, documentId, connectionId, leaseMs = config.presenceTtlMs) =>
      runDocument(collectionId, documentId, (entity) =>
        requireHeadlessConnection(collectionId, documentId, connectionId, leaseMs, entity).pipe(
          Effect.asVoid,
        ),
      ),
    getConnectionDocument: (
      collectionId,
      documentId,
      connectionId,
      leaseMs = config.presenceTtlMs,
    ) =>
      runDocument(collectionId, documentId, (entity) =>
        Effect.gen(function* () {
          yield* requireHeadlessConnection(collectionId, documentId, connectionId, leaseMs, entity);
          const loaded = yield* getDoc(collectionId, documentId).load();
          return { id: documentId, collectionId, value: loaded.value, version: loaded.version };
        }),
      ),
    submitConnectionTransaction: (
      collectionId,
      documentId,
      connectionId,
      transaction,
      leaseMs = config.presenceTtlMs,
    ) =>
      runDocument(collectionId, documentId, (entity) =>
        Effect.gen(function* () {
          const connection = yield* requireHeadlessConnection(
            collectionId,
            documentId,
            connectionId,
            leaseMs,
            entity,
          );
          const envelope: TransactionEnvelope = {
            ...transaction,
            actor: {
              connectionId,
              ...(connection.entry.userId === undefined ? {} : { userId: connection.entry.userId }),
            },
          };
          const result = yield* getDoc(collectionId, documentId).submit(envelope);
          if (result.accepted) {
            yield* entity.keyValue.put(IDLE_DIRTY_SEQ_KEY, result.version - 1);
            yield* broadcast(entity, transactionMessage(envelope, result.version));
          }
          return result;
        }),
      ),
    detachConnection: (collectionId, documentId, connectionId) =>
      runDocument(collectionId, documentId, (entity) =>
        Effect.gen(function* () {
          const removed = presenceOf(collectionId, documentId).delete(connectionId);
          if (removed) yield* broadcast(entity, presenceRemoveMessage(connectionId));
          if (removed && presenceOf(collectionId, documentId).size === 0) {
            yield* scheduleAlarmAt(entity, Date.now() + config.idleNotifyDebounceMs);
          }
        }),
      ),

    getPresenceSnapshot: (collectionId, documentId) =>
      runDocument(collectionId, documentId, (entity) =>
        Effect.gen(function* () {
          yield* prunePresence(collectionId, documentId, entity);
          return { presences: presenceSnapshot(collectionId, documentId) };
        }),
      ),
    setPresence: (collectionId, documentId, connectionId, entry) =>
      runDocument(collectionId, documentId, () =>
        Effect.sync(() => void presenceOf(collectionId, documentId).set(connectionId, { entry })),
      ),
    removePresence: (collectionId, documentId, connectionId) =>
      runDocument(collectionId, documentId, () =>
        Effect.sync(() => void presenceOf(collectionId, documentId).delete(connectionId)),
      ),
  };
};

/**
 * Builds `HostService` from the configured stores and migration registry.
 */
export const LocalHostServiceLive = Layer.effect(
  HostServiceTag,
  Effect.gen(function* () {
    const controlStore = yield* ControlStore;
    const entities = yield* DurableEntityHost;
    const migrations = yield* MigrationRegistryService;
    const documentStores = yield* DocumentStoreFactory;
    const config = getConfig();
    const control = makeControlEngine(controlStore, migrations);
    yield* entities.run(makeDurableEntityAddress("mimic-control", "default"), () =>
      Effect.gen(function* () {
        yield* ensureMigrationRegistry(controlStore, migrations);
        yield* control.ensureRootUser(config.rootUsername, config.rootPassword);
      }),
    );
    return makeLocalHostService({ control, entities, migrations, documentStores, config });
  }),
);

/** In-memory default composition for dev + tests. */
export const LocalHostServiceDefault = LocalHostServiceLive.pipe(
  Layer.provide(MemoryControlStoreLive),
  Layer.provide(EmptyMigrationRegistryLive),
  Layer.provide(MemoryDurableEntityHostLive),
  Layer.provide(MemoryDocumentStoreFactoryLive),
);
