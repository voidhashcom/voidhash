import * as Arr from "effect/Array";
import { causeMessage } from "@voidhash/lib/lang";
import type { Value } from "@voidhash/mimic-core";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as Result from "effect/Result";

import type { PresenceEntry } from "../app/hostService.ts";
import {
  decodeTransactionEnvelope,
  type SubmitTransactionResponse,
  type TransactionEnvelope,
} from "../document/transaction.ts";
import {
  authResultFailure,
  authResultSuccess,
  errorMessage,
  pong,
  presenceRemoveMessage,
  presenceSnapshotMessage,
  presenceUpdateMessage,
  snapshotMessage,
  transactionMessage,
} from "./messages.ts";
import { parseClientMessage, type ServerMessage } from "./protocol.ts";
import type { SessionRegistry } from "./session-registry.ts";

/** How long an upgraded socket may stay unauthenticated before being closed. */
export const AUTH_DEADLINE_MS = 10_000;

/** Per-socket state persisted via the hibernatable WebSocket attachment. */
export interface SessionAttachment {
  readonly connectionId: string;
  readonly collectionId: string;
  readonly documentId: string;
  readonly origin: Option.Option<string>;
  /** Epoch ms of the upgrade; drives the remaining auth deadline after hibernation. */
  readonly connectedAt?: number;
  authenticated: boolean;
  permission?: "read" | "write";
  tokenId?: string;
  presence?: PresenceEntry;
}

export interface DocumentSessionAuth {
  readonly tokenId: string;
  readonly permission: "read" | "write";
}

export interface LoadedDocumentSnapshot {
  readonly value: Value;
  readonly version: number;
}

/** Presence storage shared by WebSocket and headless document participants. */
export interface DocumentPresenceStore {
  readonly snapshot: () => Effect.Effect<Record<string, PresenceEntry>, unknown>;
  readonly set: (connectionId: string, entry: PresenceEntry) => Effect.Effect<void, unknown>;
  readonly remove: (connectionId: string) => Effect.Effect<boolean, unknown>;
  readonly prune: () => Effect.Effect<void, unknown>;
}

/**
 * Everything the WebSocket message/close handlers need from their host, so the
 * session protocol can be exercised independently of a platform runtime.
 */
export interface DocumentSessionContext<TSocket> {
  readonly registry: SessionRegistry<TSocket>;
  readonly presence: DocumentPresenceStore;
  readonly getAttachment: (socket: TSocket) => Option.Option<SessionAttachment>;
  readonly setAttachment: (socket: TSocket, attachment: SessionAttachment) => void;
  readonly send: (socket: TSocket, message: ServerMessage) => Effect.Effect<void>;
  readonly close: (socket: TSocket, code: number, reason: string) => Effect.Effect<void>;
  readonly authenticate: (
    token: string,
    attachment: SessionAttachment,
  ) => Effect.Effect<DocumentSessionAuth, unknown>;
  readonly loadDocument: () => Effect.Effect<LoadedDocumentSnapshot, { readonly message: string }>;
  readonly submitTransaction: (
    envelope: TransactionEnvelope,
  ) => Effect.Effect<SubmitTransactionResponse>;
  /**
   * Records that the document advanced to `seq` after an accepted transaction,
   * so the host can later notify that the document went idle while dirty.
   * Optional so the protocol can be exercised without an idle-notify host.
   */
  readonly onAccepted?: (seq: number) => Effect.Effect<void>;
  /**
   * Signals that a socket closed and no authenticated sockets remain, so the
   * host can arm its idle-notification debounce. Optional for the same reason.
   */
  readonly onLastAuthenticatedClose?: () => Effect.Effect<void>;
}

/**
 * Isolates one of the optional storage-backed session hooks
 * ({@link DocumentSessionContext.onAccepted} /
 * {@link DocumentSessionContext.onLastAuthenticatedClose}) so a die inside it is
 * logged and swallowed instead of escaping the message/close handler.
 *
 * The hooks are typed `Effect<…, never>` because the entity storage they
 * touch has a `never` error channel — but a transient storage failure still
 * DIES. Left unisolated, a die in `onLastAuthenticatedClose` escapes
 * {@link handleDocumentSocketClose} and skips the host's final `socket.close`
 * (surfacing as an uncaught host error); a die in `onAccepted` breaks the
 * accepted-submit broadcast. Dropping a notification just leaves the work for
 * the next disconnect, so log-and-swallow is safe.
 */
export const isolateSessionHook = <A>(
  effect: Effect.Effect<A, never>,
  label: string,
): Effect.Effect<A | void> =>
  effect.pipe(
    Effect.catchCause((cause) =>
      Effect.logError(`mimic session hook ${label} failed`, cause).pipe(
        Effect.annotateLogs({ "voidhash.mimic.session_hook": label }),
      ),
    ),
  );

/** Fans a message out to authenticated sessions only. */
export const broadcastToAuthenticated = <TSocket>(
  ctx: DocumentSessionContext<TSocket>,
  message: ServerMessage,
): Effect.Effect<void> =>
  Effect.forEach(ctx.registry.authenticated(), (socket) => ctx.send(socket, message), {
    discard: true,
    concurrency: 1,
  });

/**
 * Handles one client WebSocket frame of the document protocol. Pre-auth
 * sockets can only authenticate or ping; broadcasts never reach them.
 */
export const handleDocumentSocketMessage = <TSocket>(
  ctx: DocumentSessionContext<TSocket>,
  socket: TSocket,
  raw: string | Uint8Array,
): Effect.Effect<void> =>
  Effect.gen(function* () {
    yield* ctx.presence.prune();
    const attachmentOption = ctx.getAttachment(socket);
    if (Option.isNone(attachmentOption)) return;
    const attachment = attachmentOption.value;
    const message = yield* parseClientMessage(raw);

    yield* Match.value(message).pipe(
      Match.when({ type: "auth" }, (auth) =>
        Effect.gen(function* () {
          const result = yield* Effect.result(ctx.authenticate(auth.token, attachment));
          if (Result.isFailure(result)) {
            yield* ctx.send(socket, authResultFailure("Invalid document token"));
            return;
          }
          const loaded = yield* Effect.result(ctx.loadDocument());
          if (Result.isFailure(loaded)) {
            yield* ctx.send(
              socket,
              errorMessage(`Failed to load document: ${loaded.failure.message}`),
            );
            yield* ctx.close(socket, 1011, "Document load failed");
            return;
          }
          const next: SessionAttachment = {
            ...attachment,
            authenticated: true,
            permission: result.success.permission,
            tokenId: result.success.tokenId,
          };
          ctx.setAttachment(socket, next);
          ctx.registry.promote(next.connectionId, socket);
          yield* ctx.send(
            socket,
            authResultSuccess(result.success.tokenId, result.success.permission),
          );
          yield* ctx.send(socket, snapshotMessage(loaded.success.value, loaded.success.version));
          yield* ctx.send(
            socket,
            presenceSnapshotMessage(next.connectionId, yield* ctx.presence.snapshot()),
          );
        }),
      ),
      Match.when({ type: "ping" }, () => ctx.send(socket, pong())),
      Match.when({ type: "request_snapshot" }, () =>
        Effect.gen(function* () {
          if (!attachment.authenticated) return;
          const loaded = yield* Effect.result(ctx.loadDocument());
          if (Result.isSuccess(loaded)) {
            yield* ctx.send(socket, snapshotMessage(loaded.success.value, loaded.success.version));
          }
        }),
      ),
      Match.when({ type: "presence_set" }, (presence) =>
        Effect.gen(function* () {
          if (!attachment.authenticated || attachment.permission !== "write") return;
          const entry: PresenceEntry = { data: presence.data, userId: attachment.tokenId };
          yield* ctx.presence.set(attachment.connectionId, entry);
          ctx.setAttachment(socket, { ...attachment, presence: entry });
          yield* broadcastToAuthenticated(
            ctx,
            presenceUpdateMessage(attachment.connectionId, presence.data, attachment.tokenId),
          );
        }),
      ),
      Match.when({ type: "presence_clear" }, () =>
        Effect.gen(function* () {
          if (!attachment.authenticated) return;
          yield* ctx.presence.remove(attachment.connectionId);
          const { presence: _presence, ...next } = attachment;
          ctx.setAttachment(socket, next);
          yield* broadcastToAuthenticated(ctx, presenceRemoveMessage(attachment.connectionId));
        }),
      ),
      Match.when({ type: "submit" }, (submit) =>
        Effect.gen(function* () {
          if (!attachment.authenticated) {
            yield* ctx.send(socket, errorMessage("Not authenticated", submit.transaction.id));
            return;
          }
          if (attachment.permission !== "write") {
            yield* ctx.send(
              socket,
              errorMessage("Write permission required", submit.transaction.id),
            );
            return;
          }
          const envelope = decodeTransactionEnvelope(submit.transaction);
          const result = yield* ctx.submitTransaction(envelope);
          if (result.accepted) {
            if (ctx.onAccepted) yield* ctx.onAccepted(result.version - 1);
            yield* broadcastToAuthenticated(ctx, transactionMessage(envelope, result.version));
          } else {
            yield* ctx.send(
              socket,
              errorMessage(result.reason ?? "Transaction rejected", envelope.id),
            );
          }
        }),
      ),
      Match.exhaustive,
    );
  }).pipe(Effect.catch((error) => ctx.send(socket, errorMessage(causeMessage(error)))));

/**
 * Cleans up after a closed/errored socket: forgets the session and, when it
 * had presence, broadcasts the removal so peers do not keep ghost cursors
 * until their own reconnect.
 */
export const handleDocumentSocketClose = <TSocket>(
  ctx: DocumentSessionContext<TSocket>,
  socket: TSocket,
): Effect.Effect<void, unknown> =>
  Effect.gen(function* () {
    const attachmentOption = ctx.getAttachment(socket);
    if (Option.isNone(attachmentOption)) return;
    const attachment = attachmentOption.value;
    ctx.registry.remove(attachment.connectionId);
    const hadPresence = yield* ctx.presence.remove(attachment.connectionId);
    if (hadPresence) {
      yield* broadcastToAuthenticated(ctx, presenceRemoveMessage(attachment.connectionId));
    }
    // The closing socket was removed above; if no authenticated sockets remain,
    // the collaborative session has gone idle. Only authenticated sockets count
    // — pending pre-auth sockets never edited the document.
    if (
      ctx.onLastAuthenticatedClose &&
      !Arr.isReadonlyArrayNonEmpty(ctx.registry.authenticated())
    ) {
      yield* ctx.onLastAuthenticatedClose();
    }
  });
