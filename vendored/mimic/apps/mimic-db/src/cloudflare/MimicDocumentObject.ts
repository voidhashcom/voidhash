import * as Arr from "effect/Array";
import * as HashMap from "effect/HashMap";
import * as R from "effect/Record";
import * as P from "effect/Predicate";
import type { Value } from "@voidhash/mimic-core";
import type { MigrationRegistry } from "@voidhash/mimic-server/migrate";
import { getConfig } from "../config.ts";
import type { PresenceEntry } from "../app/hostService.ts";
import { makeControlEngine } from "../core/control-engine.ts";
import { makeDocumentEngine, type DocumentEngineApi } from "../core/document-engine.ts";
import { ensureDocumentTables, makePgDocumentStore } from "../core/pg-store.ts";
import { makeControlStoreSchemaProvider } from "../core/schema-provider.ts";
import type { ControlStoreApi } from "../core/store.ts";
import { makeControlStoreRpcClient } from "./ControlStoreRpc.ts";
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
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
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

class DocumentIdentityMismatchError extends Schema.TaggedErrorClass<DocumentIdentityMismatchError>(
  "DocumentIdentityMismatchError",
)("DocumentIdentityMismatchError", {
  message: Schema.String,
}) {}

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
const identityFromName = (
  name: string,
  stored: Option.Option<DocumentIdentity>,
): DocumentIdentity => {
  const separator = name.indexOf(":");
  if (separator >= 0) {
    return { collectionId: name.slice(0, separator), documentId: name.slice(separator + 1) };
  }
  return Option.match(stored, {
    onNone: () => ({ collectionId: "", documentId: name }),
    onSome: (identity) => identity,
  });
};

/** Read a stored idle-notify sequence number, ignoring any non-numeric value. */
const optionalNumber = (value: unknown): Option.Option<number> =>
  P.isNumber(value) ? Option.some(value) : Option.none();

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
        const controlStore: ControlStoreApi = makeControlStoreRpcClient(
          () => hosts.getByName(HOST_INSTANCE),
          provideRuntimeContext,
        );
        const control = makeControlEngine(controlStore, options.migrations);
        const schema = makeControlStoreSchemaProvider(controlStore);
        const snapshotEveryCommands = getConfig().snapshotEveryCommands;

        // The DO is addressed `${collectionId}:${documentId}`; the documentId is
        // this DO's Postgres row key.
        const storedIdentity = Option.fromUndefinedOr(
          yield* state.storage.get<DocumentIdentity>(DOCUMENT_IDENTITY_KEY),
        );
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
                new DocumentIdentityMismatchError({
                  message: `Durable Object identity mismatch: expected ${collectionId}:${documentId}, received ${identity.collectionId}:${identity.documentId}`,
                }),
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
        let presence = HashMap.empty<string, PresenceEntry>();
        let headlessConnections = HashMap.empty<string, HeadlessConnection>();
        yield* Effect.forEach(
          yield* state.getWebSockets(),
          (socket) =>
            Effect.sync(() => {
              const attachment = Option.fromNullishOr(
                socket.deserializeAttachment<SessionAttachment>(),
              );
              if (Option.isSome(attachment)) {
                registry.restore(
                  attachment.value.connectionId,
                  socket,
                  attachment.value.authenticated,
                  Option.fromUndefinedOr(attachment.value.connectedAt),
                );
                if (attachment.value.authenticated && attachment.value.presence !== undefined) {
                  presence = HashMap.set(
                    presence,
                    attachment.value.connectionId,
                    attachment.value.presence,
                  );
                }
              }
            }),
          { discard: true, concurrency: 1 },
        );
        const storedHeadless = yield* state.storage.list<HeadlessConnection>({
          prefix: HEADLESS_CONNECTION_PREFIX,
        });
        const bootTime = yield* Clock.currentTimeMillis;
        yield* Effect.forEach(
          storedHeadless,
          ([key, connection]) =>
            connection.expiresAt <= bootTime
              ? state.storage.delete(key)
              : Effect.sync(() => {
                  const connectionId = key.slice(HEADLESS_CONNECTION_PREFIX.length);
                  headlessConnections = HashMap.set(headlessConnections, connectionId, connection);
                  presence = HashMap.set(presence, connectionId, connection.entry);
                }),
          { discard: true, concurrency: 1 },
        );

        const broadcast = (message: ServerMessage) =>
          Effect.forEach(
            registry.authenticated(),
            (socket) => socket.send(encodeServerMessage(message)).pipe(Effect.ignore),
            { discard: true, concurrency: 1 },
          );

        const scheduleHeadlessExpiry = (expiresAt: number) =>
          Effect.gen(function* () {
            const scheduled = Option.fromNullishOr(yield* state.storage.getAlarm());
            if (Option.isNone(scheduled) || expiresAt < scheduled.value) {
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
            now: () => Clock.Clock.defaultValue().currentTimeMillisUnsafe(),
            authenticatedCount: () =>
              registry.authenticated().length + HashMap.size(headlessConnections),
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
          const removed = yield* Effect.forEach(
            headlessConnections,
            ([connectionId, connection]) =>
              connection.expiresAt > now
                ? Effect.succeed(false)
                : Effect.gen(function* () {
                    headlessConnections = HashMap.remove(headlessConnections, connectionId);
                    presence = HashMap.remove(presence, connectionId);
                    yield* state.storage.delete(`${HEADLESS_CONNECTION_PREFIX}${connectionId}`);
                    yield* broadcast(presenceRemoveMessage(connectionId));
                    return true;
                  }),
            { concurrency: 1 },
          );
          const removedAny = Arr.some(removed, (entry) => entry);
          if (
            removedAny &&
            Arr.isReadonlyArrayNonEmpty(registry.authenticated()) &&
            HashMap.size(headlessConnections) === 0
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
        ): Effect.Effect<Option.Option<HeadlessConnection>> =>
          Effect.gen(function* () {
            yield* pruneHeadlessConnections();
            const current = HashMap.get(headlessConnections, connectionId);
            if (Option.isNone(current)) return Option.none();
            const now = yield* Clock.currentTimeMillis;
            const next = { ...current.value, expiresAt: now + leaseMs };
            headlessConnections = HashMap.set(headlessConnections, connectionId, next);
            yield* state.storage.put(`${HEADLESS_CONNECTION_PREFIX}${connectionId}`, next);
            yield* scheduleHeadlessExpiry(next.expiresAt);
            return Option.some(next);
          }).pipe(provideRuntimeContext);

        const sessionContext: DocumentSessionContext<Cloudflare.WebSocket> = {
          registry,
          presence: {
            snapshot: () => Effect.sync(() => R.fromEntries(presence)),
            set: (connectionId, entry) =>
              Effect.sync(() => {
                presence = HashMap.set(presence, connectionId, entry);
              }),
            remove: (connectionId) =>
              Effect.sync(() => {
                const existed = HashMap.has(presence, connectionId);
                presence = HashMap.remove(presence, connectionId);
                return existed;
              }),
            prune: () => pruneHeadlessConnections().pipe(Effect.asVoid),
          },
          onAccepted: (seq) =>
            isolateSessionHook(idleNotifier().recordDirty(seq), hookLabel("recordDirty")),
          onLastAuthenticatedClose: () =>
            isolateSessionHook(
              idleNotifier().onLastAuthenticatedClose(),
              hookLabel("onLastAuthenticatedClose"),
            ),
          getAttachment: (socket) =>
            Option.fromNullishOr(socket.deserializeAttachment<SessionAttachment>()),
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
            migrationVersion: number | typeof Schema.Null.Type,
          ) =>
            ensureIdentity(identity).pipe(
              Effect.andThen(
                withEngine((engine) =>
                  engine.create(
                    identity.collectionId,
                    value,
                    schemaVersion,
                    Option.fromNullishOr(migrationVersion),
                  ),
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
                Effect.map(Option.some),
                Effect.catchTag("NotFoundError", () => Effect.succeed(Option.none())),
              );
              if (Option.isNone(loaded)) return { notFound: constant(true) };
              const now = yield* Clock.currentTimeMillis;
              const connection = { entry, expiresAt: now + leaseMs };
              headlessConnections = HashMap.set(headlessConnections, connectionId, connection);
              presence = HashMap.set(presence, connectionId, entry);
              yield* state.storage.put(`${HEADLESS_CONNECTION_PREFIX}${connectionId}`, connection);
              yield* scheduleHeadlessExpiry(connection.expiresAt);
              yield* broadcast(presenceUpdateMessage(connectionId, entry.data, entry.userId));
              return {
                found: constant(true),
                value: loaded.value.value,
                version: loaded.value.version,
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
              if (Option.isNone(connection)) return { notFound: constant(true) };
              const loaded = yield* withEngine((engine) => engine.load()).pipe(
                Effect.map(Option.some),
                Effect.catchTag("NotFoundError", () => Effect.succeed(Option.none())),
              );
              if (Option.isNone(loaded)) return { notFound: constant(true) };
              return {
                found: constant(true),
                value: loaded.value.value,
                version: loaded.value.version,
              };
            }),

          heartbeatConnection: (
            identity: DocumentIdentity,
            connectionId: string,
            leaseMs: number,
          ) =>
            ensureIdentity(identity).pipe(
              Effect.andThen(touchHeadlessConnection(connectionId, leaseMs)),
              Effect.map(Option.isSome),
            ),

          closeConnection: (identity: DocumentIdentity, connectionId: string) =>
            Effect.gen(function* () {
              yield* ensureIdentity(identity);
              const existed = HashMap.has(headlessConnections, connectionId);
              headlessConnections = HashMap.remove(headlessConnections, connectionId);
              presence = HashMap.remove(presence, connectionId);
              yield* state.storage.delete(`${HEADLESS_CONNECTION_PREFIX}${connectionId}`);
              if (existed) {
                yield* broadcast(presenceRemoveMessage(connectionId));
                if (
                  Arr.isReadonlyArrayNonEmpty(registry.authenticated()) &&
                  HashMap.size(headlessConnections) === 0
                ) {
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
              if (Option.isNone(connection)) return { notFound: constant(true) };
              const transaction: TransactionEnvelope = {
                ...envelope,
                actor: {
                  connectionId,
                  ...actorUserId(connection.value.entry.userId),
                },
              };
              const result = yield* withEngine((engine) => engine.submit(transaction)).pipe(
                Effect.map(Option.some),
                Effect.catchTag("NotFoundError", () => Effect.succeed(Option.none())),
              );
              if (Option.isNone(result)) return { notFound: constant(true) };
              if (result.value.accepted) {
                yield* isolateSessionHook(
                  idleNotifier().recordDirty(result.value.version - 1),
                  hookLabel("recordDirty"),
                );
                yield* broadcast(transactionMessage(transaction, result.value.version));
              }
              return result.value;
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
              const origin = Option.fromUndefinedOr(request.headers["origin"]);
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
                if (
                  !(
                    pruned &&
                    registry.authenticated().length + HashMap.size(headlessConnections) === 0
                  )
                ) {
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
                if (HashMap.size(headlessConnections) > 0) {
                  yield* idleStorage.setAlarm(
                    Math.min(
                      ...Arr.map(
                        Arr.fromIterable(HashMap.values(headlessConnections)),
                        ({ expiresAt }) => expiresAt,
                      ),
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
