import type { Value } from "@voidhash/mimic-core";
import { NotFoundError } from "@voidhash/mimic-server/rpc";
import { Effect } from "effect";

import { type HostService } from "../app/hostService.ts";
import type { DocumentSnapshotResponse } from "../document/snapshot.ts";
import type { SubmitTransactionResponse, TransactionEnvelope } from "../document/transaction.ts";
import { makeControlEngine } from "../core/control-engine.ts";
import type { ControlStoreApi } from "../core/store.ts";

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
  ) => Effect.Effect<void, any>;
  readonly getSnapshot: () => Effect.Effect<
    { found: true; value: Value; version: number } | { found: false; error?: string },
    any
  >;
  readonly submitRpc: (
    envelope: TransactionEnvelope,
  ) => Effect.Effect<SubmitTransactionResponse | { notFound: true }, any>;
  readonly remove: () => Effect.Effect<void, any>;
}

export interface DurableHostServiceDeps {
  /** The single control-entity stub, viewed as the control store. */
  readonly controlStore: ControlStoreApi;
  /** Resolve a document-entity stub for a document. */
  readonly docStub: (collectionId: string, documentId: string) => DocumentStub;
}

const notFound = (message: string): NotFoundError =>
  new NotFoundError({ code: "not_found", message });

const isSubmitResponse = (
  value: SubmitTransactionResponse | { notFound: true },
): value is SubmitTransactionResponse => !("notFound" in value);

/**
 * `HostService` over remote durable entity stubs. Control-plane logic runs in the
 * entry point over a control-entity stub; document operations are delegated to
 * per-document entity stubs, which serialize them and migrate on load. The
 * WebSocket realtime path lives in the document entity, so the presence and
 * connection methods here are no-ops on the RPC surface.
 */
export const makeDurableHostService = (deps: DurableHostServiceDeps): HostService => {
  const { docStub } = deps;
  const control = makeControlEngine(deps.controlStore);

  return {
    authenticateBasic: control.authenticateBasic,
    authenticateDocumentToken: control.authenticateDocumentToken,
    createDatabase: control.createDatabase,
    listDatabases: control.listDatabases,
    deleteDatabase: control.deleteDatabase,
    createCollection: control.createCollection,
    listCollections: control.listCollections,
    updateCollectionSchema: (collectionId, schemaInput) =>
      control.updateCollectionSchema(collectionId, schemaInput),
    deleteCollection: control.deleteCollection,
    listMigrations: control.listMigrations,
    applyMigration: (databaseId, version, name, checksum, changes, options) =>
      control.applyMigration(databaseId, version, name, checksum, changes, "apply", options),
    rerunMigration: (databaseId, version, name, checksum, changes, options) =>
      control.applyMigration(databaseId, version, name, checksum, changes, "rerun", options),
    replaceMigration: (databaseId, version, name, checksum, changes, options) =>
      control.applyMigration(databaseId, version, name, checksum, changes, "replace", options),
    getMigrationStatus: control.getMigrationStatus,
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
          (documentId): Effect.Effect<boolean> =>
            docStub(collectionId, documentId)
              .getSnapshot()
              .pipe(
                Effect.map((snapshot) => snapshot.found || snapshot.error !== undefined),
                // A probe failure (stub unreachable) is inconclusive; treat the
                // document as materialized so a live paywall is never re-seeded.
                Effect.catchCause(() => Effect.succeed(true)),
              ),
        );
        yield* docStub(collectionId, prepared.documentId).create(
          collectionId,
          prepared.value,
          prepared.schemaVersion,
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
        const snapshots = yield* Effect.forEach(ids, (documentId) =>
          docStub(collectionId, documentId)
            .getSnapshot()
            .pipe(
              Effect.map((snapshot) =>
                snapshot.found
                  ? ({
                      id: documentId,
                      collectionId,
                      value: snapshot.value,
                      version: snapshot.version,
                    } satisfies DocumentSnapshotResponse)
                  : undefined,
              ),
            ),
        );
        return snapshots.filter((entry): entry is DocumentSnapshotResponse => entry !== undefined);
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

    attachConnection: (collectionId, documentId) =>
      Effect.gen(function* () {
        yield* control.findDocument(collectionId, documentId);
        const snapshot = yield* docStub(collectionId, documentId).getSnapshot();
        if (!snapshot.found) {
          return yield* Effect.fail(notFound(`Document not found: ${documentId}`));
        }
        return { value: snapshot.value, version: snapshot.version, presences: {} };
      }),

    // Realtime presence and heartbeat live on the document entity's WebSocket path.
    heartbeatConnection: () => Effect.void,
    detachConnection: () => Effect.void,
    getPresenceSnapshot: () => Effect.succeed({ presences: {} }),
    setPresence: () => Effect.void,
    removePresence: () => Effect.void,
  };
};
