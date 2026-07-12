import type {
  ClientMessage,
  DocumentAuthTokenResponse,
  DocumentSnapshotResponse,
  ServerMessage,
  SubmitTransactionResponse,
  TransactionEnvelope,
} from "./protocol.js";
import type { Value } from "@voidhash/mimic-core";

export interface DocumentTransport {
  connect(): Promise<void>;
  disconnect(): void;
  subscribe(handler: (message: ServerMessage) => void): () => void;
  subscribeConnection(handler: (connected: boolean) => void): () => void;
  requestSnapshot(): void;
  submit(transaction: TransactionEnvelope): void;
  setPresence(data: Value): void;
  clearPresence(): void;
  isConnected(): boolean;
}

export interface CreateDocumentInput {
  readonly collectionId: string;
  readonly id?: string;
  readonly value: DocumentSnapshotResponse["value"];
}

export interface DocumentHttpClient {
  createDocument(input: CreateDocumentInput): Promise<DocumentSnapshotResponse>;
  getDocument(collectionId: string, documentId: string): Promise<DocumentSnapshotResponse>;
  listDocuments(collectionId: string): Promise<readonly DocumentSnapshotResponse[]>;
  deleteDocument(collectionId: string, documentId: string): Promise<void>;
  createDocumentAuthToken(input: {
    readonly collectionId: string;
    readonly documentId: string;
    readonly permission: "read" | "write";
    readonly origins: readonly string[];
    readonly expiresInSeconds?: number;
  }): Promise<DocumentAuthTokenResponse>;
  submitTransaction(
    collectionId: string,
    documentId: string,
    transaction: TransactionEnvelope,
  ): Promise<SubmitTransactionResponse>;
}

export type EncodedClientMessage = ClientMessage;
