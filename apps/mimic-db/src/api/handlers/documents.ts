import { Effect } from "effect";
import { CurrentUser, DocumentsRpcs } from "@voidhash/mimic-server/rpc";

import { HostServiceTag } from "../../app/hostService.ts";
import type { TransactionEnvelope } from "../../document/transaction.ts";

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
          // The wire schema treats commands as `Schema.Unknown[]`; the host
          // service is typed against the structured `Command[]` shape from
          // mimic-core. The host validates the command shape internally as
          // it applies them, so casting here is safe.
          return yield* host.submitTransaction(
            collectionId,
            documentId,
            transaction as TransactionEnvelope,
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
