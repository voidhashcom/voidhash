import * as Arr from "effect/Array";
import * as R from "effect/Record";
import {
  type DurableEntityContext,
  DurableEntityHost,
  makeDurableEntityAddress,
} from "@voidhash/platform/DurableEntity";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import type { MigrationRegistry } from "@voidhash/mimic-server/migrate";
import { NotFoundError } from "@voidhash/mimic-server/rpc";
import { constant } from "@voidhash/lib/lang";

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

/**
 * Whether a websocket session attachment belongs to an authenticated
 * collaborator. The entity host types attachments as `unknown`, so the shape is
 * narrowed here instead of at every broadcast site.
 */
const isAuthenticatedSession = (attachment: unknown): attachment is SessionAttachment => {
  if (!P.hasProperty(attachment, "authenticated")) return false;
  return attachment.authenticated === true;
};

/** Spreads `userId` into a presence entry only when the connection has one. */
const optionalUserId = (userId: Option.Option<string>): { readonly userId?: string } =>
  Option.match(userId, { onNone: () => ({}), onSome: (value) => ({ userId: value }) });

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
  const documents = MutableHashMap.empty<string, DocumentEngineApi>();
  const presence = MutableHashMap.empty<
    string,
    MutableHashMap.MutableHashMap<string, StoredPresence>
  >();

  const getDoc = (collectionId: string, documentId: string): DocumentEngineApi => {
    const key = docKeyOf(collectionId, documentId);
    let engine = Option.getOrUndefined(MutableHashMap.get(documents, key));
    if (!engine) {
      engine = makeDocumentEngine({
        store: documentStores.make(collectionId, documentId),
        migrations,
        schema,
        snapshotEveryCommands: config.snapshotEveryCommands,
      });
      MutableHashMap.set(documents, key, engine);
    }
    return engine;
  };

  const presenceOf = (
    collectionId: string,
    documentId: string,
  ): MutableHashMap.MutableHashMap<string, StoredPresence> => {
    const key = docKeyOf(collectionId, documentId);
    let entries = Option.getOrUndefined(MutableHashMap.get(presence, key));
    if (!entries) {
      entries = MutableHashMap.empty();
      MutableHashMap.set(presence, key, entries);
    }
    return entries;
  };

  const presenceSnapshot = (
    collectionId: string,
    documentId: string,
  ): Record<string, PresenceEntry> =>
    R.fromEntries(
      Array.from(presenceOf(collectionId, documentId)).map(([connectionId, stored]) => [
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
            const attachment = yield* session.getAttachment;
            if (!isAuthenticatedSession(attachment)) return;
            yield* session.send(encodeServerMessage(message));
          }),
        { discard: true, concurrency: 1 },
      );
    });

  const scheduleAlarmAt = (entity: DurableEntityContext, scheduledTime: number) =>
    Effect.gen(function* () {
      const current = yield* entity.alarm.get;
      if (Option.isNone(current) || scheduledTime < current.value) {
        yield* entity.alarm.set(scheduledTime);
      }
    });

  const scheduleNextPresenceExpiry = (
    entries: MutableHashMap.MutableHashMap<string, StoredPresence>,
    entity: DurableEntityContext,
  ) => {
    const expirations: number[] = [];
    Array.from(MutableHashMap.values(entries)).forEach(({ expiresAt }) => {
      if (expiresAt !== undefined) expirations.push(expiresAt);
    });
    if (!Arr.isReadonlyArrayNonEmpty(expirations)) return Effect.void;
    return scheduleAlarmAt(entity, Math.min(...expirations));
  };

  const prunePresence = (
    collectionId: string,
    documentId: string,
    entity: DurableEntityContext,
  ): Effect.Effect<void> =>
    Effect.gen(function* () {
      const entries = presenceOf(collectionId, documentId);
      const now = yield* Clock.currentTimeMillis;
      yield* Effect.forEach(
        Array.from(entries),
        ([connectionId, stored]) => {
          if (stored.expiresAt === undefined || stored.expiresAt > now) return Effect.void;
          MutableHashMap.remove(entries, connectionId);
          return broadcast(entity, presenceRemoveMessage(connectionId));
        },
        { concurrency: 1, discard: true },
      );
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
      const current = Option.getOrUndefined(MutableHashMap.get(entries, connectionId));
      if (current?.expiresAt === undefined) {
        return yield* Effect.fail(connectionNotFound(connectionId));
      }
      const now = yield* Clock.currentTimeMillis;
      const next = { ...current, expiresAt: now + leaseMs };
      MutableHashMap.set(entries, connectionId, next);
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
        const documentId = Option.getOrElse(id, randomId);
        return runDocument(collectionId, documentId, () =>
          Effect.gen(function* () {
            // Probe the per-document engine so prepareDocument can heal a half-dead
            // index row (live + same-collection, but the document engine holds no
            // state) instead of conflicting forever — see prepareDocument.
            const prepared = yield* runControl(() =>
              control.prepareDocument(
                collectionId,
                Option.some(documentId),
                value,
                Option.some((preparedId) =>
                  getDoc(collectionId, preparedId)
                    .load()
                    .pipe(
                      Effect.as(true),
                      Effect.catchTag("NotFoundError", () => Effect.succeed(false)),
                      Effect.catchTag("MigrationFailedError", () => Effect.succeed(true)),
                    ),
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
        return yield* Effect.forEach(
          ids,
          (documentId) =>
            runDocument(collectionId, documentId, () =>
              getDoc(collectionId, documentId)
                .load()
                .pipe(
                  Effect.map((loaded) =>
                    constant({
                      id: documentId,
                      collectionId,
                      value: loaded.value,
                      version: loaded.version,
                    }),
                  ),
                ),
            ),
          { concurrency: 1 },
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
            ...optionalUserId(Option.fromUndefinedOr(userId)),
          };
          const now = yield* Clock.currentTimeMillis;
          const stored = {
            entry,
            expiresAt: now + leaseMs,
          };
          MutableHashMap.set(presenceOf(collectionId, documentId), connectionId, stored);
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
              ...optionalUserId(Option.fromUndefinedOr(connection.entry.userId)),
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
          const entries = presenceOf(collectionId, documentId);
          const removed = MutableHashMap.has(entries, connectionId);
          MutableHashMap.remove(entries, connectionId);
          if (removed) yield* broadcast(entity, presenceRemoveMessage(connectionId));
          if (removed && MutableHashMap.isEmpty(entries)) {
            const now = yield* Clock.currentTimeMillis;
            yield* scheduleAlarmAt(entity, now + config.idleNotifyDebounceMs);
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
        Effect.sync(
          () =>
            void MutableHashMap.set(presenceOf(collectionId, documentId), connectionId, { entry }),
        ),
      ),
    removePresence: (collectionId, documentId, connectionId) =>
      runDocument(collectionId, documentId, () =>
        Effect.sync(
          () => void MutableHashMap.remove(presenceOf(collectionId, documentId), connectionId),
        ),
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
    yield* entities.run(
      makeDurableEntityAddress("mimic-control", "default"),
      Effect.fn("LocalHostServiceLive")(function* () {
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
