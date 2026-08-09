import { Effect } from "effect";
import { CurrentUser, DocumentsRpcs } from "@voidhash/mimic-server/rpc";

import { HostServiceTag } from "../../app/hostService.ts";
import {
  decodeDocumentValue,
  decodeTransactionEnvelope,
} from "../../document/transaction.ts";

export const DocumentsHandlersLive = DocumentsRpcs.toLayer(
  Effect.gen(function* () {
    const host = yield* HostServiceTag;
    return {
      CreateDocument: ({ collectionId, id, value }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const databaseId = yield* host.databaseIdForCollection(collectionId);
          yield* host.ensureDatabasePermission(user.userId, user.isSuperuser, databaseId, "write");
          return yield* host.createDocument(collectionId, id, value);
        }),
      GetDocument: ({ collectionId, documentId }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const databaseId = yield* host.databaseIdForCollection(collectionId);
          yield* host.ensureDatabasePermission(user.userId, user.isSuperuser, databaseId, "read");
          return yield* host.getDocument(collectionId, documentId);
        }),
      ListDocuments: ({ collectionId }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const databaseId = yield* host.databaseIdForCollection(collectionId);
          yield* host.ensureDatabasePermission(user.userId, user.isSuperuser, databaseId, "read");
          return yield* host.listDocuments(collectionId);
        }),
      SubmitTransaction: ({ collectionId, documentId, transaction }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const databaseId = yield* host.databaseIdForCollection(collectionId);
          yield* host.ensureDatabasePermission(user.userId, user.isSuperuser, databaseId, "write");
          // The wire schema treats commands as opaque JSON; the host service is
          // typed against the structured `Command[]` shape from mimic-core and
          // validates the command shape internally as it applies them.
          return yield* host.submitTransaction(
            collectionId,
            documentId,
            decodeTransactionEnvelope(transaction),
          );
        }),
      OpenDocumentConnection: ({ collectionId, documentId, connectionId, presence, leaseMs }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const databaseId = yield* host.databaseIdForCollection(collectionId);
          yield* host.ensureDatabasePermission(user.userId, user.isSuperuser, databaseId, "write");
          const snapshot = yield* host.attachConnection(
            collectionId,
            documentId,
            connectionId,
            "write",
            user.userId,
            decodeDocumentValue(presence),
            leaseMs,
          );
          return { id: documentId, collectionId, value: snapshot.value, version: snapshot.version };
        }),
      GetConnectedDocument: ({ collectionId, documentId, connectionId, leaseMs }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const databaseId = yield* host.databaseIdForCollection(collectionId);
          yield* host.ensureDatabasePermission(user.userId, user.isSuperuser, databaseId, "write");
          return yield* host.getConnectionDocument(collectionId, documentId, connectionId, leaseMs);
        }),
      HeartbeatDocumentConnection: ({ collectionId, documentId, connectionId, leaseMs }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const databaseId = yield* host.databaseIdForCollection(collectionId);
          yield* host.ensureDatabasePermission(user.userId, user.isSuperuser, databaseId, "write");
          yield* host.heartbeatConnection(collectionId, documentId, connectionId, leaseMs);
        }),
      CloseDocumentConnection: ({ collectionId, documentId, connectionId }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const databaseId = yield* host.databaseIdForCollection(collectionId);
          yield* host.ensureDatabasePermission(user.userId, user.isSuperuser, databaseId, "write");
          yield* host.detachConnection(collectionId, documentId, connectionId);
        }),
      SubmitConnectedTransaction: ({
        collectionId,
        documentId,
        connectionId,
        transaction,
        leaseMs,
      }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const databaseId = yield* host.databaseIdForCollection(collectionId);
          yield* host.ensureDatabasePermission(user.userId, user.isSuperuser, databaseId, "write");
          return yield* host.submitConnectionTransaction(
            collectionId,
            documentId,
            connectionId,
            decodeTransactionEnvelope(transaction),
            leaseMs,
          );
        }),
      DeleteDocument: ({ collectionId, documentId }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const databaseId = yield* host.databaseIdForCollection(collectionId);
          yield* host.ensureDatabasePermission(user.userId, user.isSuperuser, databaseId, "write");
          yield* host.deleteDocument(collectionId, documentId);
        }),
    };
  }),
);
