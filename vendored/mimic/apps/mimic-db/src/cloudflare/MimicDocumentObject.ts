import type { Value } from "@voidhash/mimic-core";
import type { MigrationRegistry } from "@voidhash/mimic-server/migrate";
import { getConfig } from "../config.ts";
import type { PresenceEntry } from "../app/hostService.ts";
import { makeControlEngine } from "../core/control-engine.ts";
import { makeDocumentEngine, type DocumentEngineApi } from "../core/document-engine.ts";
import { ensureDocumentTables, makePgDocumentStore } from "../core/pg-store.ts";
import { makeControlStoreSchemaProvider } from "../core/schema-provider.ts";
import type { ControlStoreApi } from "../core/store.ts";
import type { TransactionEnvelope } from "../document/transaction.ts";
import {
  AUTH_DEADLINE_MS,
  handleDocumentSocketClose,
  handleDocumentSocketMessage,
  isolateSessionHook,
  type DocumentSessionContext,
  type SessionAttachment,
} from "../ws/document-session.ts";
import {
  makeIdleNotifier,
  type IdleNotifyStorage,
  type MimicDocumentIdleMessageType,
} from "../ws/idle-notify.ts";
import {
  presenceRemoveMessage,
  presenceUpdateMessage,
  transactionMessage,
} from "../ws/messages.ts";
import { encodeServerMessage, type ServerMessage } from "../ws/protocol.ts";
import { makeSessionRegistry } from "../ws/session-registry.ts";
import { constant, stringOr } from "@voidhash/lib/lang";
import * as Cloudflare from "alchemy/Cloudflare";
import { RuntimeContext } from "alchemy/RuntimeContext";
import { Clock, Effect, Layer } from "effect";
import { HttpServerRequest } from "effect/unstable/http";

import { makeCloudflareDurableEntityStorage } from "@voidhash/platform-cloudflare/DurableEntity";
import type { makeMimicHostObject } from "./MimicHostObject.ts";
import { findHyperdrive, pgConfigFromHyperdrive } from "./MimicRuntimeBindings.ts";

const HOST_INSTANCE = "default";
const HEADLESS_CONNECTION_PREFIX = "headlessConnection:";
const DOCUMENT_IDENTITY_KEY = "documentIdentity";

interface DocumentIdentity {
  readonly collectionId: string;
  readonly documentId: string;
}

interface HeadlessConnection {
  readonly entry: PresenceEntry;
  readonly expiresAt: number;
}

export interface MimicDocumentObjectOptions {
  readonly hostObject: ReturnType<typeof makeMimicHostObject>;
  readonly migrations: MigrationRegistry;
  readonly publishIdleMessage?: (
    env: Record<string, unknown>,
    message: MimicDocumentIdleMessageType,
  ) => Effect.Effect<void, unknown>;
  readonly telemetry?: (env: Record<string, unknown>, stage: string) => Layer.Layer<never>;
}

/**
 * Resolve this DO's `${collectionId}:${documentId}` identity from its instance
 * name, falling back to the identity persisted on a previous boot when the name
 * carries no separator.
 */
const identityFromName = (name: string, stored: DocumentIdentity | undefined): DocumentIdentity => {
  const separator = name.indexOf(":");
  if (separator >= 0) {
    return { collectionId: name.slice(0, separator), documentId: name.slice(separator + 1) };
  }
  return { collectionId: stored?.collectionId ?? "", documentId: stored?.documentId ?? name };
};

/** Read a stored idle-notify sequence number, ignoring any non-numeric value. */
const optionalNumber = (value: unknown): number | undefined => {
  if (typeof value === "number") return value;
  return undefined;
};

/** Spreadable actor identity — omits `userId` entirely when the entry has none. */
const actorUserId = (userId: PresenceEntry["userId"]) => {
  if (userId === undefined) return {};
  return { userId };
};

/**
 * Wall-clock millis for the synchronous `now()` callbacks the mimic session
 * APIs take. `Clock` is a `Context.Reference` with a live default, so running it
 * needs no layer.
 */
const nowMillis = () => Effect.runSync(Clock.currentTimeMillis);

/**
 * Per-document Durable Object — the unit that replaces an Effect-Cluster entity.
 * Keyed by `"${collectionId}:${documentId}"`, it serializes the document's
 * transactions (single-threaded), migrates itself to the collection's latest
 * schema on load, and fans out realtime updates to its own hibernatable
 * WebSocket connections.
 *
 * Durable state — snapshots + the command log — is persisted in **Postgres**
 * (via the shared Cloudflare Hyperdrive binding), not the Worker's SQLite. The
 * DO is pure coordination + realtime; Postgres is the system of record. Hyperdrive
 * credentials are per-invocation, so a fresh store is built per operation.
 *
 * Document migrations are imported with the worker and run before a document
 * can be read or attached to a realtime session.
 */
export const makeMimicDocumentObject = (options: MimicDocumentObjectOptions) => {
  class MimicDocumentObject extends Cloudflare.DurableObject<MimicDocumentObject>()(
    "MimicDocumentObject",
    Effect.gen(function* () {
      const hosts = yield* options.hostObject;
      const env = yield* Cloudflare.WorkerEnvironment;

      return Effect.gen(function* () {
        const state = yield* Cloudflare.DurableObjectState;
        const runtimeContext = yield* RuntimeContext;
        const provideRuntimeContext = <A, E>(
          effect: Effect.Effect<A, E, RuntimeContext>,
        ): Effect.Effect<A, E> =>
          effect.pipe(Effect.provideService(RuntimeContext, runtimeContext));
        const hostStub = hosts.getByName(HOST_INSTANCE);
        const controlStore: ControlStoreApi = hostStub;
        const control = makeControlEngine(controlStore, options.migrations);
        const schema = makeControlStoreSchemaProvider(controlStore);
        const snapshotEveryCommands = getConfig().snapshotEveryCommands;

        // The DO is addressed `${collectionId}:${documentId}`; the documentId is
        // this DO's Postgres row key.
        const storedIdentity = yield* state.storage.get<DocumentIdentity>(DOCUMENT_IDENTITY_KEY);
        const name = state.id.name ?? "";
        let { collectionId, documentId } = identityFromName(name, storedIdentity);

        /**
         * Wrap one Durable Object entry point in a root span plus a per-invocation
         * OTLP exporter.
         *
         * The layer MUST be built per invocation, not once at DO construction: the
         * exporter flushes on scope close and the isolate can be evicted between
         * events, so a DO-lifetime exporter would silently drop its last buffer.
         * `Effect.suspend` also defers reading `collectionId`/`documentId`, which
         * are only resolved once the first identity-carrying call lands.
         * Resolves to a free no-op when the OTEL bindings are absent.
         */
        const withTelemetry = <A, E, R>(
          spanName: string,
          effect: Effect.Effect<A, E, R>,
        ): Effect.Effect<A, E, R> =>
          Effect.suspend(() => {
            const identity = {
              "voidhash.mimic.collection_id": collectionId,
              "voidhash.mimic.document_id": documentId,
            };
            return effect.pipe(
              Effect.withSpan(spanName, { attributes: identity }),
              Effect.annotateLogs(identity),
              Effect.provide(
                options.telemetry?.(env, stringOr(env["APP_ENV"], "development")) ?? Layer.empty,
              ),
            );
          });

        const ensureIdentity = (identity: DocumentIdentity) =>
          Effect.gen(function* () {
            if (
              (collectionId !== "" && collectionId !== identity.collectionId) ||
              (documentId !== "" && documentId !== identity.documentId)
            ) {
              return yield* Effect.die(
                new Error(
                  `Durable Object identity mismatch: expected ${collectionId}:${documentId}, received ${identity.collectionId}:${identity.documentId}`,
                ),
              );
            }
            collectionId = identity.collectionId;
            documentId = identity.documentId;
            yield* state.storage.put(DOCUMENT_IDENTITY_KEY, identity);
          });

        // Ensure the Postgres tables exist once per DO boot. Hyperdrive is bound
        // on the Worker (Hyperdrive can't bind to a Container/DO host); the DO
        // reads the runtime binding off the Worker env.
        yield* ensureDocumentTables(pgConfigFromHyperdrive(findHyperdrive(env)));

        /** Build a fresh Postgres-backed engine per operation (per-invocation creds). */
        const withEngine = <A, E>(f: (engine: DocumentEngineApi) => Effect.Effect<A, E>) =>
          Effect.gen(function* () {
            const config = pgConfigFromHyperdrive(findHyperdrive(env));
            const store = makePgDocumentStore(config, documentId);
            const engine = makeDocumentEngine({
              store,
              migrations: options.migrations,
              schema,
              snapshotEveryCommands,
            });
            return yield* f(engine);
          });

        // Rebuild the live-session index and live socket presence after
        // hibernation. Leased headless participant presence is restored below.
        // Only authenticated sockets rejoin the broadcast set; pre-auth sockets
        // get the remainder of their auth deadline.
        const registry = makeSessionRegistry<Cloudflare.WebSocket>({
          authDeadlineMs: AUTH_DEADLINE_MS,
          isAuthenticated: (socket) =>
            socket.deserializeAttachment<SessionAttachment>()?.authenticated === true,
          close: (socket) => socket.ws.close(1008, "Authentication deadline exceeded"),
        });
        const presence = new Map<string, PresenceEntry>();
        const headlessConnections = new Map<string, HeadlessConnection>();
        for (const socket of yield* state.getWebSockets()) {
          const attachment = socket.deserializeAttachment<SessionAttachment>();
          if (attachment) {
            registry.restore(
              attachment.connectionId,
              socket,
              attachment.authenticated,
              attachment.connectedAt,
            );
            if (attachment.authenticated && attachment.presence !== undefined) {
              presence.set(attachment.connectionId, attachment.presence);
            }
          }
        }
        const storedHeadless = yield* state.storage.list<HeadlessConnection>({
          prefix: HEADLESS_CONNECTION_PREFIX,
        });
        const bootTime = yield* Clock.currentTimeMillis;
        for (const [key, connection] of storedHeadless) {
          const connectionId = key.slice(HEADLESS_CONNECTION_PREFIX.length);
          if (connection.expiresAt <= bootTime) {
            yield* state.storage.delete(key);
            continue;
          }
          headlessConnections.set(connectionId, connection);
          presence.set(connectionId, connection.entry);
        }

        const broadcast = (message: ServerMessage) =>
          Effect.forEach(
            registry.authenticated(),
            (socket) => socket.send(encodeServerMessage(message)).pipe(Effect.ignore),
            { discard: true },
          );

        const scheduleHeadlessExpiry = (expiresAt: number) =>
          Effect.gen(function* () {
            const scheduled = yield* state.storage.getAlarm();
            if (scheduled === null || expiresAt < scheduled) {
              yield* state.storage.setAlarm(expiresAt);
            }
          });

        // Idle-notification trigger. Sequence numbers live in the DO's own
        // storage (document state lives in Postgres); the queue producer is read
        // raw off the Worker env, mirroring the Hyperdrive binding.
        const entityStorage = makeCloudflareDurableEntityStorage(state.storage, runtimeContext);
        const idleStorage: IdleNotifyStorage = {
          get: (key) => entityStorage.keyValue.get(key).pipe(Effect.map(optionalNumber)),
          put: (key, value) => entityStorage.keyValue.put(key, value),
          setAlarm: entityStorage.alarm.set,
        };
        const idleNotifier = () =>
          makeIdleNotifier({
            collectionId,
            documentId,
            storage: idleStorage,
            debounceMs: getConfig().idleNotifyDebounceMs,
            now: nowMillis,
            authenticatedCount: () => registry.authenticated().length + headlessConnections.size,
            publish: (message) => options.publishIdleMessage?.(env, message) ?? Effect.void,
          });

        // Isolate the storage-backed idle-notify hooks (mirroring the `alarm`
        // handler below): their `DurableObjectStorage` effects have a `never` error
        // channel but a transient storage failure DIES. `isolateSessionHook` logs
        // and swallows such a die so it never escapes the close/message handlers —
        // see its jsdoc. A dropped notification just leaves the work for the next
        // disconnect.
        const hookLabel = (name: string) => `${name} (${collectionId}:${documentId})`;

        const pruneHeadlessConnectionsWithContext = Effect.fnUntraced(function* () {
          const now = yield* Clock.currentTimeMillis;
          let removedAny = false;
          for (const [connectionId, connection] of headlessConnections) {
            if (connection.expiresAt > now) continue;
            removedAny = true;
            headlessConnections.delete(connectionId);
            presence.delete(connectionId);
            yield* state.storage.delete(`${HEADLESS_CONNECTION_PREFIX}${connectionId}`);
            yield* broadcast(presenceRemoveMessage(connectionId));
          }
          if (
            removedAny &&
            registry.authenticated().length === 0 &&
            headlessConnections.size === 0
          ) {
            yield* isolateSessionHook(
              idleNotifier().onLastAuthenticatedClose(),
              hookLabel("onLastAuthenticatedClose"),
            );
          }
          return removedAny;
        });
        const pruneHeadlessConnections = () =>
          provideRuntimeContext(pruneHeadlessConnectionsWithContext());

        const touchHeadlessConnection = (
          connectionId: string,
          leaseMs: number,
        ): Effect.Effect<HeadlessConnection | undefined> =>
          Effect.gen(function* () {
            yield* pruneHeadlessConnections();
            const current = headlessConnections.get(connectionId);
            if (current === undefined) return undefined;
            const now = yield* Clock.currentTimeMillis;
            const next = { ...current, expiresAt: now + leaseMs };
            headlessConnections.set(connectionId, next);
            yield* state.storage.put(`${HEADLESS_CONNECTION_PREFIX}${connectionId}`, next);
            yield* scheduleHeadlessExpiry(next.expiresAt);
            return next;
          }).pipe(provideRuntimeContext);

        const sessionContext: DocumentSessionContext<Cloudflare.WebSocket> = {
          registry,
          presence: {
            snapshot: () => Effect.sync(() => Object.fromEntries(presence)),
            set: (connectionId, entry) => Effect.sync(() => void presence.set(connectionId, entry)),
            remove: (connectionId) => Effect.sync(() => presence.delete(connectionId)),
            prune: () => pruneHeadlessConnections().pipe(Effect.asVoid),
          },
          onAccepted: (seq) =>
            isolateSessionHook(idleNotifier().recordDirty(seq), hookLabel("recordDirty")),
          onLastAuthenticatedClose: () =>
            isolateSessionHook(
              idleNotifier().onLastAuthenticatedClose(),
              hookLabel("onLastAuthenticatedClose"),
            ),
          getAttachment: (socket) => socket.deserializeAttachment<SessionAttachment>(),
          setAttachment: (socket, attachment) => socket.serializeAttachment(attachment),
          send: (socket, message) => socket.send(encodeServerMessage(message)).pipe(Effect.ignore),
          close: (socket, code, reason) => socket.close(code, reason).pipe(Effect.ignore),
          authenticate: (token, attachment) =>
            control.authenticateDocumentToken(
              token,
              attachment.collectionId,
              attachment.documentId,
              attachment.origin,
            ),
          loadDocument: () => withEngine((engine) => engine.load()),
          submitTransaction: (envelope) =>
            withEngine((engine) => engine.submit(envelope)).pipe(
              Effect.catchTag("NotFoundError", () =>
                Effect.succeed({
                  accepted: false,
                  version: 0,
                  transactionId: envelope.id,
                  reason: "Document not found",
                }),
              ),
            ),
        };

        return {
          create: (
            identity: DocumentIdentity,
            value: Value,
            schemaVersion: number,
            migrationVersion: number | null,
          ) =>
            ensureIdentity(identity).pipe(
              Effect.andThen(
                withEngine((engine) =>
                  engine.create(identity.collectionId, value, schemaVersion, migrationVersion),
                ),
              ),
            ),

          getSnapshot: (identity: DocumentIdentity) =>
            ensureIdentity(identity).pipe(
              Effect.andThen(
                withEngine((engine) =>
                  engine.load().pipe(
                    Effect.map((loaded) => ({
                      found: constant(true),
                      value: loaded.value,
                      version: loaded.version,
                    })),
                    Effect.catchTag("NotFoundError", () =>
                      Effect.succeed({ found: constant(false) }),
                    ),
                    Effect.catchTag("MigrationFailedError", (error) =>
                      Effect.succeed({ found: constant(false), error: error.message }),
                    ),
                  ),
                ),
              ),
            ),

          submitRpc: (identity: DocumentIdentity, envelope: TransactionEnvelope) =>
            ensureIdentity(identity).pipe(
              Effect.andThen(withEngine((engine) => engine.submit(envelope))),
              Effect.tap((result) => {
                if (!result.accepted) return Effect.void;
                return Effect.gen(function* () {
                  yield* isolateSessionHook(
                    idleNotifier().recordDirty(result.version - 1),
                    hookLabel("recordDirty"),
                  );
                  yield* broadcast(transactionMessage(envelope, result.version));
                });
              }),
              Effect.catchTag("NotFoundError", () => Effect.succeed({ notFound: constant(true) })),
            ),

          openConnection: (
            identity: DocumentIdentity,
            connectionId: string,
            entry: PresenceEntry,
            leaseMs: number,
          ) =>
            Effect.gen(function* () {
              yield* ensureIdentity(identity);
              yield* pruneHeadlessConnections();
              const loaded = yield* withEngine((engine) => engine.load()).pipe(
                Effect.catchTag("NotFoundError", () => Effect.succeed(undefined)),
              );
              if (loaded === undefined) return { notFound: constant(true) };
              const now = yield* Clock.currentTimeMillis;
              const connection = { entry, expiresAt: now + leaseMs };
              headlessConnections.set(connectionId, connection);
              presence.set(connectionId, entry);
              yield* state.storage.put(`${HEADLESS_CONNECTION_PREFIX}${connectionId}`, connection);
              yield* scheduleHeadlessExpiry(connection.expiresAt);
              yield* broadcast(presenceUpdateMessage(connectionId, entry.data, entry.userId));
              return {
                found: constant(true),
                value: loaded.value,
                version: loaded.version,
              };
            }),

          getConnectionSnapshot: (
            identity: DocumentIdentity,
            connectionId: string,
            leaseMs: number,
          ) =>
            Effect.gen(function* () {
              yield* ensureIdentity(identity);
              const connection = yield* touchHeadlessConnection(connectionId, leaseMs);
              if (connection === undefined) return { notFound: constant(true) };
              const loaded = yield* withEngine((engine) => engine.load()).pipe(
                Effect.catchTag("NotFoundError", () => Effect.succeed(undefined)),
              );
              if (loaded === undefined) return { notFound: constant(true) };
              return { found: constant(true), value: loaded.value, version: loaded.version };
            }),

          heartbeatConnection: (
            identity: DocumentIdentity,
            connectionId: string,
            leaseMs: number,
          ) =>
            ensureIdentity(identity).pipe(
              Effect.andThen(touchHeadlessConnection(connectionId, leaseMs)),
              Effect.map((connection) => connection !== undefined),
            ),

          closeConnection: (identity: DocumentIdentity, connectionId: string) =>
            Effect.gen(function* () {
              yield* ensureIdentity(identity);
              const existed = headlessConnections.delete(connectionId);
              presence.delete(connectionId);
              yield* state.storage.delete(`${HEADLESS_CONNECTION_PREFIX}${connectionId}`);
              if (existed) {
                yield* broadcast(presenceRemoveMessage(connectionId));
                if (registry.authenticated().length === 0 && headlessConnections.size === 0) {
                  yield* isolateSessionHook(
                    idleNotifier().onLastAuthenticatedClose(),
                    hookLabel("onLastAuthenticatedClose"),
                  );
                }
              }
              return existed;
            }),

          submitConnection: (
            identity: DocumentIdentity,
            connectionId: string,
            leaseMs: number,
            envelope: TransactionEnvelope,
          ) =>
            Effect.gen(function* () {
              yield* ensureIdentity(identity);
              const connection = yield* touchHeadlessConnection(connectionId, leaseMs);
              if (connection === undefined) return { notFound: constant(true) };
              const transaction: TransactionEnvelope = {
                ...envelope,
                actor: {
                  connectionId,
                  ...actorUserId(connection.entry.userId),
                },
              };
              const result = yield* withEngine((engine) => engine.submit(transaction)).pipe(
                Effect.catchTag("NotFoundError", () => Effect.succeed(undefined)),
              );
              if (result === undefined) return { notFound: constant(true) };
              if (result.accepted) {
                yield* isolateSessionHook(
                  idleNotifier().recordDirty(result.version - 1),
                  hookLabel("recordDirty"),
                );
                yield* broadcast(transactionMessage(transaction, result.version));
              }
              return result;
            }),

          remove: (identity: DocumentIdentity) =>
            ensureIdentity(identity).pipe(Effect.andThen(withEngine((engine) => engine.remove()))),

          fetch: withTelemetry(
            "do.fetch MimicDocumentObject",
            Effect.gen(function* () {
              const request = yield* HttpServerRequest.HttpServerRequest;
              const url = new URL(request.url, "http://mimic");
              // /ws/v1/databases/:db/collections/:collectionId/documents/:documentId
              const parts = url.pathname.split("/").filter(Boolean);
              const collectionId = decodeURIComponent(parts[5] ?? "");
              const documentIdFromUrl = decodeURIComponent(parts[7] ?? "");
              yield* ensureIdentity({ collectionId, documentId: documentIdFromUrl });
              const origin = request.headers["origin"] ?? null;
              const [response, socket] = yield* Cloudflare.upgrade();
              const connectedAt = yield* Clock.currentTimeMillis;
              const attachment: SessionAttachment = {
                connectionId: globalThis.crypto.randomUUID(),
                collectionId,
                documentId: documentIdFromUrl,
                origin,
                connectedAt,
                authenticated: false,
              };
              socket.serializeAttachment(attachment);
              // Not added to the broadcast set until auth succeeds; closed if the
              // socket never authenticates.
              registry.trackPending(attachment.connectionId, socket);
              return response;
            }),
          ),

          // One telemetry scope per WS frame — the handler has already written its
          // reply to the socket by the time the exporter flushes, so the flush adds
          // no client-visible latency, and an exporter held across the socket's
          // lifetime would never flush at all (the isolate hibernates between
          // frames).
          webSocketMessage: Effect.fnUntraced(function* (
            socket: Cloudflare.WebSocket,
            message: string | Uint8Array,
          ) {
            yield* withTelemetry(
              "do.wsmessage MimicDocumentObject",
              handleDocumentSocketMessage(sessionContext, socket, message),
            );
          }),

          webSocketClose: Effect.fnUntraced(function* (
            socket: Cloudflare.WebSocket,
            code: number,
            reason: string,
          ) {
            yield* withTelemetry(
              "do.wsclose MimicDocumentObject",
              handleDocumentSocketClose(sessionContext, socket),
            );
            yield* socket.close(code, reason);
          }),

          // Debounce alarm fired: publish the idle notification if the session is
          // still empty and the document is dirty beyond what we last notified.
          // Fully resilient — storage/publish failures are logged, never thrown —
          // so a transient failure just leaves the work for the next disconnect.
          alarm: Effect.fnUntraced(function* () {
            yield* withTelemetry(
              "do.alarm MimicDocumentObject",
              Effect.gen(function* () {
                const pruned = yield* pruneHeadlessConnections();
                if (!(pruned && registry.authenticated().length + headlessConnections.size === 0)) {
                  yield* idleNotifier()
                    .onAlarm()
                    .pipe(
                      Effect.catchCause((cause) =>
                        Effect.logError(
                          `mimic idle-notify alarm failed for ${collectionId}:${documentId}`,
                          cause,
                        ).pipe(
                          Effect.annotateLogs({ "voidhash.mimic.operation": "idleNotify.onAlarm" }),
                        ),
                      ),
                    );
                }
                if (headlessConnections.size > 0) {
                  yield* idleStorage.setAlarm(
                    Math.min(
                      ...[...headlessConnections.values()].map(({ expiresAt }) => expiresAt),
                    ),
                  );
                }
              }),
            );
          }),
        };
      });
    }),
  ) {}

  return MimicDocumentObject;
};
