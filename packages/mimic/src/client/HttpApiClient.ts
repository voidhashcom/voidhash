import type { Value } from "@voidhash/mimic-core";

import { encodeBasicAuth, joinUrl, resolveFetch } from "../shared/browser.js";
import type {
  DocumentAuthTokenResponse,
  DocumentSnapshotResponse,
  SubmitTransactionResponse,
  TransactionEnvelope,
} from "./protocol.js";
import type { CreateDocumentInput, DocumentHttpClient } from "./Transport.js";

export interface MimicDbHttpClientOptions {
  readonly baseUrl: string;
  readonly auth?: {
    readonly username: string;
    readonly password: string;
  };
  readonly fetch?: typeof globalThis.fetch;
}

const jsonHeaders = {
  "content-type": "application/json",
} as const;

export class MimicDbHttpClient implements DocumentHttpClient {
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(private readonly options: MimicDbHttpClientOptions) {
    this.fetchImpl = resolveFetch(options.fetch);
  }

  async createDocument(input: CreateDocumentInput): Promise<DocumentSnapshotResponse> {
    return this.request<DocumentSnapshotResponse>(
      `/api/v1/collections/${encodeURIComponent(input.collectionId)}/documents`,
      {
        method: "POST",
        body: JSON.stringify({
          id: input.id,
          value: input.value,
        }),
      },
    );
  }

  async getDocument(collectionId: string, documentId: string): Promise<DocumentSnapshotResponse> {
    return this.request<DocumentSnapshotResponse>(
      `/api/v1/collections/${encodeURIComponent(collectionId)}/documents/${encodeURIComponent(documentId)}`,
      {
        method: "GET",
      },
    );
  }

  async listDocuments(collectionId: string): Promise<readonly DocumentSnapshotResponse[]> {
    return this.request<readonly DocumentSnapshotResponse[]>(
      `/api/v1/collections/${encodeURIComponent(collectionId)}/documents`,
      {
        method: "GET",
      },
    );
  }

  async deleteDocument(collectionId: string, documentId: string): Promise<void> {
    await this.request(
      `/api/v1/collections/${encodeURIComponent(collectionId)}/documents/${encodeURIComponent(documentId)}`,
      {
        method: "DELETE",
      },
    );
  }

  async createDocumentAuthToken(input: {
    readonly collectionId: string;
    readonly documentId: string;
    readonly permission: "read" | "write";
    readonly origins: readonly string[];
    readonly expiresInSeconds?: number;
  }): Promise<DocumentAuthTokenResponse> {
    return this.request<DocumentAuthTokenResponse>("/api/v1/documents/auth-tokens", {
      method: "POST",
      body: JSON.stringify({
        collectionId: input.collectionId,
        documentId: input.documentId,
        permission: input.permission,
        origins: [...input.origins],
        expiresInSeconds: input.expiresInSeconds,
      }),
    });
  }

  async submitTransaction(
    collectionId: string,
    documentId: string,
    transaction: TransactionEnvelope,
  ): Promise<SubmitTransactionResponse> {
    return this.request<SubmitTransactionResponse>(
      `/api/v1/collections/${encodeURIComponent(collectionId)}/documents/${encodeURIComponent(documentId)}/transactions`,
      {
        method: "POST",
        body: JSON.stringify(transaction),
      },
    );
  }

  private async request<T = void>(
    path: string,
    init: {
      readonly method: string;
      readonly body?: string;
    },
  ): Promise<T> {
    const headers = new Headers(jsonHeaders);
    if (this.options.auth) {
      headers.set(
        "authorization",
        encodeBasicAuth(this.options.auth.username, this.options.auth.password),
      );
    }

    const response = await this.fetchImpl(joinUrl(this.options.baseUrl, path), {
      method: init.method,
      headers,
      body: init.body,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `HTTP ${response.status} ${response.statusText}: ${text || "request failed"}`,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }
}

export const createDocumentInput = (
  collectionId: string,
  value: Value,
  id?: string,
): CreateDocumentInput => ({
  collectionId,
  id,
  value,
});
