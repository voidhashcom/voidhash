// oxlint-disable-next-line effect/noNodeBuiltinImport -- Node platform adapter: it upgrades connections on the real http.Server created by the standalone entrypoint, so it needs that module's own types.
import type { IncomingMessage, Server } from "node:http";
// oxlint-disable-next-line effect/noNodeBuiltinImport -- the WebSocket upgrade handler receives a node:stream Duplex from the Node HTTP server; Stream/Channel cannot type that handshake argument.
import type { Duplex } from "node:stream";

import { createIdGenerator } from "@voidhash/core/utils/generate-id";
import { causeMessage, constant } from "@voidhash/lib/lang";
import type { HostService } from "@voidhash/mimic-db/app/hostService";
import {
  AUTH_DEADLINE_MS,
  handleDocumentSocketClose,
  handleDocumentSocketMessage,
  type DocumentSessionContext,
  type SessionAttachment,
} from "@voidhash/mimic-db/ws/document-session";
import {
  makeIdleNotifier,
  type MimicDocumentIdleMessageType,
} from "@voidhash/mimic-db/ws/idle-notify";
import { encodeServerMessage } from "@voidhash/mimic-db/ws/protocol";
import { makeSessionRegistry } from "@voidhash/mimic-db/ws/session-registry";
import {
  DurableEntityHost,
  type DurableEntityAlarmControlShape,
  type DurableEntityContext,
  type DurableEntitySession,
  makeDurableEntityAddress,
} from "@voidhash/platform/DurableEntity";
import { makeNodeDurableEntitySession } from "@voidhash/platform-selfhost/NodeDurableEntitySession";
import { Clock, Duration, Effect, Fiber, Semaphore } from "effect";
import WebSocket, { WebSocketServer, type RawData } from "ws";

import {
  dispatchDurableEntityAlarms,
  type DurableEntityAlarmHandler,
} from "../DurableEntityAlarms.ts";

interface NodeDocumentSocket {
  readonly webSocket: WebSocket;
  /**
   * The entity-side handle for this socket. Host-side broadcasts read their
   * attachment from here, so every attachment write has to reach it.
   */
  readonly entitySession: DurableEntitySession;
  attachment: SessionAttachment | null;
}

interface NodeDocumentRuntime {
  readonly lock: Semaphore.Semaphore;
  readonly connections: Set<NodeDocumentSocket>;
  readonly context: DocumentSessionContext<NodeDocumentSocket>;
}

/** Persisted idle-notification settings for the Node WebSocket host. */
export interface MimicNodeIdleNotificationOptions {
  readonly control: DurableEntityAlarmControlShape;
  readonly debounceMs: number;
  readonly publish: (message: MimicDocumentIdleMessageType) => Effect.Effect<void, unknown>;
  readonly pollIntervalMs?: number;
  readonly additionalAlarmHandlers?: Readonly<Record<string, DurableEntityAlarmHandler>>;
}

const mimicDocumentEntityType = "mimic-document";

/** Ephemeral per-socket connection ids; opaque outside this adapter. */
const generateConnectionId = createIdGenerator({ connection: "conn" });

/** Reads wall-clock millis through the ambient `Clock` from a sync callback. */
const nowMillis = (): number => Effect.runSync(Clock.currentTimeMillis);

const numberOrUndefined = (value: unknown): number | undefined => {
  if (typeof value === "number") return value;
  return undefined;
};

const documentKey = (collectionId: string, documentId: string): string =>
  `${collectionId}\u0000${documentId}`;

const documentEntityAddress = (collectionId: string, documentId: string) =>
  makeDurableEntityAddress(mimicDocumentEntityType, `${collectionId}:${documentId}`);

const parseDocumentEntityId = (
  id: string,
): { readonly collectionId: string; readonly documentId: string } | undefined => {
  const separator = id.indexOf(":");
  if (separator <= 0 || separator === id.length - 1) return undefined;
  return {
    collectionId: id.slice(0, separator),
    documentId: id.slice(separator + 1),
  };
};

const makeNodeIdleNotifier = (
  entity: DurableEntityContext,
  collectionId: string,
  documentId: string,
  authenticatedCount: () => number,
  options: MimicNodeIdleNotificationOptions,
) =>
  makeIdleNotifier({
    authenticatedCount,
    collectionId,
    debounceMs: options.debounceMs,
    documentId,
    now: nowMillis,
    publish: options.publish,
    storage: {
      get: (key) => entity.keyValue.get(key).pipe(Effect.map(numberOrUndefined)),
      put: (key, value) => entity.keyValue.put(key, value),
      setAlarm: entity.alarm.set,
    },
  });

/** Dispatches all currently-due Mimic document alarms once. */
export const dispatchMimicDocumentIdleAlarms = (
  entities: DurableEntityHost["Service"],
  options: MimicNodeIdleNotificationOptions,
  authenticatedCount: (collectionId: string, documentId: string) => number,
): Effect.Effect<void, unknown> =>
  dispatchDurableEntityAlarms(options.control, {
    [mimicDocumentEntityType]: (address, now) => {
      const document = parseDocumentEntityId(address.id);
      if (!document) {
        return Effect.logWarning(`Ignoring malformed Mimic document entity alarm ${address.id}`);
      }
      return entities.run(address, (entity) =>
        Effect.gen(function* () {
          const scheduledTime = yield* entity.alarm.get;
          if (scheduledTime === undefined || scheduledTime > now) return;
          yield* entity.alarm.delete;
          yield* makeNodeIdleNotifier(
            entity,
            document.collectionId,
            document.documentId,
            () => authenticatedCount(document.collectionId, document.documentId),
            options,
          ).onAlarm();
        }),
      );
    },
  });

const parseDocumentAddress = (
  request: IncomingMessage,
): { readonly collectionId: string; readonly documentId: string } | undefined => {
  const url = new URL(request.url ?? "/", "http://mimic");
  const parts = url.pathname.split("/").filter(Boolean);
  if (
    parts.length !== 8 ||
    parts[0] !== "ws" ||
    parts[1] !== "v1" ||
    parts[2] !== "databases" ||
    parts[4] !== "collections" ||
    parts[6] !== "documents"
  ) {
    return undefined;
  }
  return {
    collectionId: decodeURIComponent(parts[5] ?? ""),
    documentId: decodeURIComponent(parts[7] ?? ""),
  };
};

const toFrame = (data: RawData, isBinary: boolean): string | Uint8Array => {
  // `ws` hands text frames over as a Buffer, an ArrayBuffer or a Buffer[]
  // depending on `binaryType`; only the Buffer case decodes correctly on its
  // own, so the other two are normalized before being read as text.
  if (!isBinary) {
    if (data instanceof ArrayBuffer) return Buffer.from(data).toString();
    if (Array.isArray(data)) return Buffer.concat(data).toString();
    return data.toString();
  }
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (Array.isArray(data)) return new Uint8Array(Buffer.concat(data));
  return new Uint8Array(data);
};

// HostService's legacy signatures retain `R = any`; the fully-built entry
// layer has already discharged those requirements at this adapter boundary.
const withoutRequirements = <A, E>(effect: Effect.Effect<A, E>): Effect.Effect<A, E> => effect;

const run = (effect: Effect.Effect<void, unknown>): void => {
  Effect.runFork(
    effect.pipe(
      Effect.catchCause((cause) => Effect.logError("mimic Node WebSocket handler failed", cause)),
    ),
  );
};

/**
 * Installs the portable mimic document protocol on a Node HTTP server's
 * WebSocket upgrade path. Returns a close function for server shutdown.
 */
export const installMimicNodeWebSocketServer = (
  server: Server,
  host: HostService,
  entities: DurableEntityHost["Service"],
  idleNotifications: MimicNodeIdleNotificationOptions,
): (() => void) => {
  const webSockets = new WebSocketServer({ noServer: true });
  const documents = new Map<string, NodeDocumentRuntime>();

  const runtimeFor = (collectionId: string, documentId: string): NodeDocumentRuntime => {
    const key = documentKey(collectionId, documentId);
    const existing = documents.get(key);
    if (existing) return existing;

    const registry = makeSessionRegistry<NodeDocumentSocket>({
      authDeadlineMs: AUTH_DEADLINE_MS,
      isAuthenticated: (socket) => socket.attachment?.authenticated === true,
      close: (socket) => socket.webSocket.close(1008, "Authentication deadline exceeded"),
    });
    const entityAddress = documentEntityAddress(collectionId, documentId);
    const idleNotifier = (entity: DurableEntityContext) =>
      makeNodeIdleNotifier(
        entity,
        collectionId,
        documentId,
        () => registry.authenticated().length,
        idleNotifications,
      );
    const context: DocumentSessionContext<NodeDocumentSocket> = {
      registry,
      presence: {
        snapshot: () =>
          withoutRequirements(host.getPresenceSnapshot(collectionId, documentId)).pipe(
            Effect.map(({ presences }) => presences),
          ),
        set: (connectionId, entry) =>
          withoutRequirements(host.setPresence(collectionId, documentId, connectionId, entry)),
        remove: (connectionId) =>
          Effect.gen(function* () {
            const { presences } = yield* withoutRequirements(
              host.getPresenceSnapshot(collectionId, documentId),
            );
            const existed = connectionId in presences;
            yield* withoutRequirements(host.removePresence(collectionId, documentId, connectionId));
            return existed;
          }),
        prune: () =>
          withoutRequirements(host.getPresenceSnapshot(collectionId, documentId)).pipe(
            Effect.asVoid,
          ),
      },
      getAttachment: (socket) => socket.attachment,
      // Authentication replaces the attachment object rather than mutating it,
      // so the entity session has to be updated too. Without this write-through
      // the host-side broadcast keeps reading the pre-auth attachment and
      // silently skips every authenticated browser socket.
      setAttachment: (socket, attachment) => {
        socket.attachment = attachment;
        Effect.runSync(socket.entitySession.setAttachment(attachment));
      },
      send: (socket, message) =>
        Effect.sync(() =>  socket.webSocket.send(encodeServerMessage(message))),
      close: (socket, code, reason) => Effect.sync(() =>  socket.webSocket.close(code, reason)),
      authenticate: (token, attachment) =>
        withoutRequirements(
          host.authenticateDocumentToken(
            token,
            attachment.collectionId,
            attachment.documentId,
            attachment.origin,
          ),
        ),
      loadDocument: () =>
        withoutRequirements(host.getDocument(collectionId, documentId)).pipe(
          Effect.mapError((error) => ({ message: causeMessage(error) })),
        ),
      submitTransaction: (transaction) =>
        withoutRequirements(host.submitTransaction(collectionId, documentId, transaction)).pipe(
          Effect.catch((error) =>
            Effect.succeed({
              accepted: constant(false),
              version: 0,
              transactionId: transaction.id,
              reason: causeMessage(error),
            }),
          ),
        ),
      onAccepted: (seq) =>
        entities.run(entityAddress, (entity) => idleNotifier(entity).recordDirty(seq)),
      onLastAuthenticatedClose: () =>
        entities.run(entityAddress, (entity) => idleNotifier(entity).onLastAuthenticatedClose()),
    };
    const runtime = {
      lock: Semaphore.makeUnsafe(1),
      connections: new Set<NodeDocumentSocket>(),
      context,
    };
    documents.set(key, runtime);
    return runtime;
  };

  const onUpgrade = (request: IncomingMessage, socket: Duplex, head: Buffer): void => {
    const address = parseDocumentAddress(request);
    if (!address) {
      return;
    }
    webSockets.handleUpgrade(request, socket, head, (webSocket) => {
      const runtime = runtimeFor(address.collectionId, address.documentId);
      const attachment: SessionAttachment = {
        connectionId: generateConnectionId("connection"),
        collectionId: address.collectionId,
        documentId: address.documentId,
        origin: request.headers.origin ?? null,
        connectedAt: nowMillis(),
        authenticated: false,
      };
      const entitySession = makeNodeDurableEntitySession(
        attachment.connectionId,
        {
          send: (message) => webSocket.send(message),
          close: (code, reason) => webSocket.close(code, reason),
        },
        attachment,
      );
      const nodeSocket: NodeDocumentSocket = { webSocket, entitySession, attachment };
      runtime.connections.add(nodeSocket);
      runtime.context.registry.trackPending(attachment.connectionId, nodeSocket);
      const entityAddress = documentEntityAddress(address.collectionId, address.documentId);
      const ready = Effect.runPromise(
        entities.run(entityAddress, (entity) => entity.sessions.attach(entitySession)),
      );
      webSocket.on("message", (data, isBinary) => {
        run(
          Effect.promise(() => ready).pipe(
            Effect.andThen(
              runtime.lock.withPermit(
                handleDocumentSocketMessage(runtime.context, nodeSocket, toFrame(data, isBinary)),
              ),
            ),
          ),
        );
      });
      webSocket.once("close", () => {
        run(
          Effect.promise(() => ready).pipe(
            Effect.andThen(
              runtime.lock.withPermit(
                Effect.gen(function* () {
                  yield* handleDocumentSocketClose(runtime.context, nodeSocket);
                  const attachment = nodeSocket.attachment;
                  if (attachment) {
                    yield* entities.run(entityAddress, (entity) =>
                      entity.sessions.remove(attachment.connectionId),
                    );
                  }
                  runtime.connections.delete(nodeSocket);
                  if (runtime.connections.size === 0) {
                    documents.delete(documentKey(address.collectionId, address.documentId));
                  }
                }),
              ),
            ),
          ),
        );
      });
    });
  };

  const alarmFiber = Effect.runFork(
    Effect.forever(
      dispatchDurableEntityAlarms(idleNotifications.control, {
        [mimicDocumentEntityType]: (address, now) => {
          const document = parseDocumentEntityId(address.id);
          if (!document) {
            return Effect.logWarning(
              `Ignoring malformed Mimic document entity alarm ${address.id}`,
            );
          }
          return Effect.gen(function* () {
            const due = yield* entities.run(address, (entity) =>
              Effect.gen(function* () {
                const scheduledTime = yield* entity.alarm.get;
                if (scheduledTime === undefined || scheduledTime > now) return false;
                yield* entity.alarm.delete;
                return true;
              }),
            );
            if (!due) return;
            const { presences } = yield* withoutRequirements(
              host.getPresenceSnapshot(document.collectionId, document.documentId),
            );
            yield* entities.run(address, (entity) =>
              Effect.gen(function* () {
                yield* makeNodeIdleNotifier(
                  entity,
                  document.collectionId,
                  document.documentId,
                  () => Object.keys(presences).length,
                  idleNotifications,
                ).onAlarm();
              }),
            );
          });
        },
        ...idleNotifications.additionalAlarmHandlers,
      }).pipe(
        Effect.catchCause((cause) =>
          Effect.logError("Mimic document alarm dispatch failed", cause),
        ),
        Effect.andThen(Effect.sleep(Duration.millis(idleNotifications.pollIntervalMs ?? 500))),
      ),
    ),
  );
  server.on("upgrade", onUpgrade);
  return () => {
    server.off("upgrade", onUpgrade);
    Effect.runFork(Fiber.interrupt(alarmFiber));
    for (const client of webSockets.clients) client.close(1001, "Server shutting down");
    webSockets.close();
  };
};
