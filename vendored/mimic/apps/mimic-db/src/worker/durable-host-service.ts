import type { Value } from "@voidhash/mimic-core";
import type { MigrationRegistry } from "@voidhash/mimic-server/migrate";
import { NotFoundError } from "@voidhash/mimic-server/rpc";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { type HostService } from "../app/hostService.ts";
import type { DocumentSnapshotResponse } from "../document/snapshot.ts";
import type { SubmitTransactionResponse, TransactionEnvelope } from "../document/transaction.ts";
import { makeControlEngine } from "../core/control-engine.ts";
import type { ControlStoreApi } from "../core/store.ts";
import { getConfig } from "../config.ts";

/**
 * The subset of a document-entity stub the HTTP entry point calls. Remote
 * adapters resolve without Effect requirements, so the requirement channel is
 * `never` (an `any` here leaks into every caller's `R`).
 */
export interface DocumentStub {
  readonly create: (
    collectionId: string,
    value: Value,
    schemaVersion: number,
    migrationVersion: number | typeof Schema.Null.Type,
  ) => Effect.Effect<void, any>;
  readonly getSnapshot: () => Effect.Effect<
    { found: true; value: Value; version: number } | { found: false; error?: string },
    any
  >;
  readonly submitRpc: (
    envelope: TransactionEnvelope,
  ) => Effect.Effect<SubmitTransactionResponse | { notFound: true }, any>;
  readonly openConnection: (
    connectionId: string,
    entry: { readonly data: Value; readonly userId?: string },
    leaseMs: number,
  ) => Effect.Effect<
    | { readonly found: true; readonly value: Value; readonly version: number }
    | { readonly notFound: true },
    any
  >;
  readonly getConnectionSnapshot: (
    connectionId: string,
    leaseMs: number,
  ) => Effect.Effect<
    | { readonly found: true; readonly value: Value; readonly version: number }
    | { readonly notFound: true },
    any
  >;
  readonly heartbeatConnection: (
    connectionId: string,
    leaseMs: number,
  ) => Effect.Effect<boolean, any>;
  readonly closeConnection: (connectionId: string) => Effect.Effect<boolean, any>;
  readonly submitConnection: (
    connectionId: string,
    leaseMs: number,
    envelope: TransactionEnvelope,
  ) => Effect.Effect<SubmitTransactionResponse | { readonly notFound: true }, any>;
  readonly remove: () => Effect.Effect<void, any>;
}

export interface DurableHostServiceDeps {
  /** The single control-entity stub, viewed as the control store. */
  readonly controlStore: ControlStoreApi;
  readonly migrations: MigrationRegistry;
  /** Resolve a document-entity stub for a document. */
  readonly docStub: (collectionId: string, documentId: string) => DocumentStub;
}

const notFound = (message: string): NotFoundError =>
  new NotFoundError({ code: "not_found", message });

/** Builds the presence entry for a headless connection, omitting an absent `userId`. */
const presenceEntry = (
  data: Value,
  userId: Option.Option<string>,
): { readonly data: Value; readonly userId?: string } => {
  if (Option.isNone(userId)) return { data };
  return { data, userId: userId.value };
};

const isSubmitResponse = (
  value: SubmitTransactionResponse | { notFound: true },
): value is SubmitTransactionResponse => !("notFound" in value);

/**
 * `HostService` over remote durable entity stubs. Control-plane logic runs in the
 * entry point over a control-entity stub; document operations are delegated to
 * per-document entity stubs, which serialize them and migrate on load. The
 * WebSocket realtime path and leased headless connections both live in the
 * document entity, so accepted transactions and presence changes share one
 * serialized broadcast boundary.
 */
export const makeDurableHostService = (deps: DurableHostServiceDeps): HostService => {
  const { docStub } = deps;
  const control = makeControlEngine(deps.controlStore, deps.migrations);

  const connectionLeaseMs = (leaseMs: Option.Option<number>) =>
    Option.getOrElse(leaseMs, () => getConfig().presenceTtlMs);

  return {
    authenticateBasic: control.authenticateBasic,
    authenticateDocumentToken: control.authenticateDocumentToken,
    createDatabase: control.createDatabase,
    listDatabases: control.listDatabases,
    deleteDatabase: control.deleteDatabase,
    createCollection: control.createCollection,
    listCollections: control.listCollections,
    deleteCollection: control.deleteCollection,
    createUser: control.createUser,
    listUsers: control.listUsers,
    deleteUser: control.deleteUser,
    grantPermission: control.grantPermission,
    revokePermission: control.revokePermission,
    listGrants: control.listGrants,
    createDocumentAuthToken: control.createDocumentToken,
    ensureDatabasePermission: control.ensureDatabasePermission,
    databaseIdForCollection: control.databaseIdForCollection,

    createDocument: (collectionId, id, value) =>
      Effect.gen(function* () {
        // Probe the per-document object so prepareDocument can heal a half-dead
        // index row (live + same-collection, but the document object holds no
        // state) instead of conflicting forever — see prepareDocument. A
        // migration failure (`found:false` WITH an error) still means state
        // exists, so it is treated as materialized (never re-seeded).
        const prepared = yield* control.prepareDocument(
          collectionId,
          id,
          value,
          Option.some(
            (documentId): Effect.Effect<boolean> =>
              docStub(collectionId, documentId)
                .getSnapshot()
                .pipe(
                  Effect.exit,
                  Effect.map((result) =>
                    Exit.isFailure(result)
                      ? true
                      : result.value.found || result.value.error !== undefined,
                  ),
                ),
          ),
        );
        yield* docStub(collectionId, prepared.documentId).create(
          collectionId,
          prepared.value,
          prepared.schemaVersion,
          Option.getOrNull(prepared.migrationVersion),
        );
        return { id: prepared.documentId, collectionId, value: prepared.value, version: 1 };
      }),

    getDocument: (collectionId, documentId) =>
      Effect.gen(function* () {
        yield* control.findDocument(collectionId, documentId);
        const snapshot = yield* docStub(collectionId, documentId).getSnapshot();
        if (!snapshot.found) {
          return yield* Effect.fail(
            notFound(snapshot.error ?? `Document not found: ${documentId}`),
          );
        }
        return {
          id: documentId,
          collectionId,
          value: snapshot.value,
          version: snapshot.version,
        } satisfies DocumentSnapshotResponse;
      }),

    listDocuments: (collectionId) =>
      Effect.gen(function* () {
        const ids = yield* control.listDocumentIds(collectionId);
        const snapshots = yield* Effect.forEach(
          ids,
          (documentId) =>
            docStub(collectionId, documentId)
              .getSnapshot()
              .pipe(
                Effect.map((snapshot) => {
                  if (!snapshot.found) return Option.none<DocumentSnapshotResponse>();
                  return Option.some({
                    id: documentId,
                    collectionId,
                    value: snapshot.value,
                    version: snapshot.version,
                  } satisfies DocumentSnapshotResponse);
                }),
              ),
          { concurrency: 1 },
        );
        return Arr.getSomes(snapshots);
      }),

    deleteDocument: (collectionId, documentId) =>
      Effect.gen(function* () {
        yield* control.findDocument(collectionId, documentId);
        yield* control.markDocumentDeleted(documentId);
        yield* docStub(collectionId, documentId).remove();
      }),

    submitTransaction: (collectionId, documentId, transaction) =>
      Effect.gen(function* () {
        yield* control.findDocument(collectionId, documentId);
        const result = yield* docStub(collectionId, documentId).submitRpc(transaction);
        if (!isSubmitResponse(result)) {
          return yield* Effect.fail(notFound(`Document not found: ${documentId}`));
        }
        return result;
      }),

    attachConnection: (
      collectionId,
      documentId,
      connectionId,
      _permission,
      userId,
      presence,
      leaseMs,
    ) =>
      Effect.gen(function* () {
        yield* control.findDocument(collectionId, documentId);
        if (presence === undefined) {
          return yield* Effect.fail(notFound("Headless connections require presence data"));
        }
        const snapshot = yield* docStub(collectionId, documentId).openConnection(
          connectionId,
          presenceEntry(presence, Option.fromUndefinedOr(userId)),
          connectionLeaseMs(Option.fromUndefinedOr(leaseMs)),
        );
        if (!("found" in snapshot)) {
          return yield* Effect.fail(notFound(`Document not found: ${documentId}`));
        }
        return { value: snapshot.value, version: snapshot.version, presences: {} };
      }),
    heartbeatConnection: (collectionId, documentId, connectionId, leaseMs) =>
      docStub(collectionId, documentId)
        .heartbeatConnection(connectionId, connectionLeaseMs(Option.fromUndefinedOr(leaseMs)))
        .pipe(
          Effect.flatMap((found) => {
            if (found) return Effect.void;
            return Effect.fail(notFound(`Connection not found: ${connectionId}`));
          }),
        ),
    getConnectionDocument: (collectionId, documentId, connectionId, leaseMs) =>
      docStub(collectionId, documentId)
        .getConnectionSnapshot(connectionId, connectionLeaseMs(Option.fromUndefinedOr(leaseMs)))
        .pipe(
          Effect.flatMap((snapshot) => {
            if (!("found" in snapshot)) {
              return Effect.fail(notFound(`Connection not found: ${connectionId}`));
            }
            return Effect.succeed({
              id: documentId,
              collectionId,
              value: snapshot.value,
              version: snapshot.version,
            });
          }),
        ),
    submitConnectionTransaction: (collectionId, documentId, connectionId, transaction, leaseMs) =>
      docStub(collectionId, documentId)
        .submitConnection(
          connectionId,
          connectionLeaseMs(Option.fromUndefinedOr(leaseMs)),
          transaction,
        )
        .pipe(
          Effect.flatMap((result) => {
            if ("notFound" in result) {
              return Effect.fail(notFound(`Connection not found: ${connectionId}`));
            }
            return Effect.succeed(result);
          }),
        ),
    detachConnection: (collectionId, documentId, connectionId) =>
      docStub(collectionId, documentId).closeConnection(connectionId).pipe(Effect.asVoid),
    // Browser WebSocket presence is held directly by the document object.
    getPresenceSnapshot: () => Effect.succeed({ presences: {} }),
    setPresence: () => Effect.void,
    removePresence: () => Effect.void,
  };
};
