import * as Schema from "effect/Schema";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

import {
  ConflictError,
  ForbiddenError,
  InvalidValueError,
  NotFoundError,
  VersionConflictError,
} from "../errors.ts";
import { AuthMiddleware } from "../middleware.ts";
import {
  DocumentSnapshotResponseSchema,
  SubmitTransactionResponseSchema,
  TransactionEnvelopeSchema,
  ValueRpcSchema,
} from "../schemas.ts";

export const CreateDocument = Rpc.make("CreateDocument", {
  payload: Schema.Struct({
    collectionId: Schema.String,
    id: Schema.optional(Schema.String),
    value: ValueRpcSchema,
  }),
  success: DocumentSnapshotResponseSchema,
  error: Schema.Union([NotFoundError, ConflictError, InvalidValueError, ForbiddenError]),
});

export const GetDocument = Rpc.make("GetDocument", {
  payload: Schema.Struct({
    collectionId: Schema.String,
    documentId: Schema.String,
  }),
  success: DocumentSnapshotResponseSchema,
  error: Schema.Union([NotFoundError, ForbiddenError]),
});

export const ListDocuments = Rpc.make("ListDocuments", {
  payload: Schema.Struct({
    collectionId: Schema.String,
  }),
  success: Schema.Array(DocumentSnapshotResponseSchema),
  error: Schema.Union([NotFoundError, ForbiddenError]),
});

export const SubmitTransaction = Rpc.make("SubmitTransaction", {
  payload: Schema.Struct({
    collectionId: Schema.String,
    documentId: Schema.String,
    transaction: TransactionEnvelopeSchema,
  }),
  success: SubmitTransactionResponseSchema,
  error: Schema.Union([NotFoundError, InvalidValueError, VersionConflictError, ForbiddenError]),
});

export const OpenDocumentConnection = Rpc.make("OpenDocumentConnection", {
  payload: Schema.Struct({
    collectionId: Schema.String,
    documentId: Schema.String,
    connectionId: Schema.String,
    presence: ValueRpcSchema,
    leaseMs: Schema.optional(Schema.Number),
  }),
  success: DocumentSnapshotResponseSchema,
  error: Schema.Union([NotFoundError, ForbiddenError]),
});

export const GetConnectedDocument = Rpc.make("GetConnectedDocument", {
  payload: Schema.Struct({
    collectionId: Schema.String,
    documentId: Schema.String,
    connectionId: Schema.String,
    leaseMs: Schema.optional(Schema.Number),
  }),
  success: DocumentSnapshotResponseSchema,
  error: Schema.Union([NotFoundError, ForbiddenError]),
});

export const HeartbeatDocumentConnection = Rpc.make("HeartbeatDocumentConnection", {
  payload: Schema.Struct({
    collectionId: Schema.String,
    documentId: Schema.String,
    connectionId: Schema.String,
    leaseMs: Schema.optional(Schema.Number),
  }),
  success: Schema.Void,
  error: Schema.Union([NotFoundError, ForbiddenError]),
});

export const CloseDocumentConnection = Rpc.make("CloseDocumentConnection", {
  payload: Schema.Struct({
    collectionId: Schema.String,
    documentId: Schema.String,
    connectionId: Schema.String,
  }),
  success: Schema.Void,
  error: Schema.Union([NotFoundError, ForbiddenError]),
});

export const SubmitConnectedTransaction = Rpc.make("SubmitConnectedTransaction", {
  payload: Schema.Struct({
    collectionId: Schema.String,
    documentId: Schema.String,
    connectionId: Schema.String,
    leaseMs: Schema.optional(Schema.Number),
    transaction: TransactionEnvelopeSchema,
  }),
  success: SubmitTransactionResponseSchema,
  error: Schema.Union([NotFoundError, InvalidValueError, VersionConflictError, ForbiddenError]),
});

export const DeleteDocument = Rpc.make("DeleteDocument", {
  payload: Schema.Struct({
    collectionId: Schema.String,
    documentId: Schema.String,
  }),
  success: Schema.Void,
  error: Schema.Union([NotFoundError, ForbiddenError]),
});

export const DocumentsRpcs = RpcGroup.make(
  CreateDocument,
  GetDocument,
  ListDocuments,
  SubmitTransaction,
  OpenDocumentConnection,
  GetConnectedDocument,
  HeartbeatDocumentConnection,
  CloseDocumentConnection,
  SubmitConnectedTransaction,
  DeleteDocument,
).middleware(AuthMiddleware);
