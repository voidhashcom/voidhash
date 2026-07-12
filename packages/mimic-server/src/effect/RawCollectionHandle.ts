import { Effect } from "effect";

import type { MimicSDK } from "./MimicSDK.ts";
import type {
  DocumentAuthenticationSetup,
  RawDocumentSnapshot,
  SetupDocumentAuthenticationOptions,
} from "./types.ts";

/**
 * A granular transaction envelope for {@link RawCollectionHandle.submitTransaction}:
 * a `baseVersion` (optimistic-concurrency anchor) and the `commands` batch to
 * apply. `commands` are passed straight through as raw JSON — the caller owns
 * command construction (e.g. `reconcile()` output). `id` is optional; a random
 * one is minted when omitted. Mirrors the server `TransactionEnvelope` shape.
 */
export interface RawTransactionInput {
  readonly baseVersion: number;
  readonly commands: readonly unknown[];
  readonly id?: string;
}

/** Result of {@link RawCollectionHandle.submitTransaction}. */
export interface RawTransactionResult {
  readonly accepted: boolean;
  readonly version: number;
  readonly transactionId: string;
  readonly reason?: string;
}

/**
 * "Raw" collection handle for callers that work with dynamic schemas at
 * runtime (admin UI, tooling). Does not encode/decode through a `Primitive`;
 * values are passed straight through as JSON.
 *
 * The interface intentionally mirrors `CollectionHandle` shape-wise but
 * with `Raw` suffixes so it's clear the caller is opting out of typed
 * marshalling.
 */
export class RawCollectionHandle {
  readonly id: string;
  readonly databaseId: string;
  readonly sdk: MimicSDK;

  constructor(id: string, databaseId: string, sdk: MimicSDK) {
    this.id = id;
    this.databaseId = databaseId;
    this.sdk = sdk;
  }

  createDocumentRaw(
    value: unknown,
    options?: { readonly id?: string },
  ): Effect.Effect<RawDocumentSnapshot, unknown> {
    return this.sdk.runEffect(
      (client) =>
        client.CreateDocument({
          collectionId: this.id,
          id: options?.id,
          value,
        }) as Effect.Effect<RawDocumentSnapshot, unknown>,
    );
  }

  getDocumentRaw(documentId: string): Effect.Effect<RawDocumentSnapshot, unknown> {
    return this.sdk.runEffect(
      (client) =>
        client.GetDocument({
          collectionId: this.id,
          documentId,
        }) as Effect.Effect<RawDocumentSnapshot, unknown>,
    );
  }

  listDocumentsRaw(): Effect.Effect<ReadonlyArray<RawDocumentSnapshot>, unknown> {
    return this.sdk.runEffect(
      (client) =>
        client.ListDocuments({ collectionId: this.id }) as Effect.Effect<
          ReadonlyArray<RawDocumentSnapshot>,
          unknown
        >,
    );
  }

  deleteDocument(documentId: string) {
    return this.sdk.runEffect((client) =>
      client.DeleteDocument({ collectionId: this.id, documentId }),
    );
  }

  /**
   * Replace a document's value via a single-command transaction. Reads the
   * current version, then submits `[{ kind: "value.set", path: [], value }]`.
   * Mirrors the previous admin behavior so admin's UI doesn't need to
   * implement the transaction protocol.
   */
  setDocumentRaw(
    documentId: string,
    value: unknown,
  ): Effect.Effect<{ readonly id: string; readonly version: number }, unknown> {
    const collectionId = this.id;
    return this.sdk.runEffect((client) =>
      Effect.gen(function* () {
        const current = (yield* client.GetDocument({
          collectionId,
          documentId,
        })) as RawDocumentSnapshot;

        const transactionId =
          typeof globalThis.crypto?.randomUUID === "function"
            ? globalThis.crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

        const result = yield* client.SubmitTransaction({
          collectionId,
          documentId,
          transaction: {
            id: transactionId,
            baseVersion: current.version,
            commands: [
              {
                kind: "value.set",
                path: [],
                value,
              },
            ],
          },
        });

        if (!result.accepted) {
          return yield* Effect.die(new Error(result.reason ?? "Document update rejected"));
        }

        return { id: documentId, version: result.version };
      }),
    );
  }

  /**
   * Submit a GRANULAR transaction — an arbitrary `commands` batch at an explicit
   * `baseVersion` — over the same `SubmitTransaction` RPC as
   * {@link setDocumentRaw}, but WITHOUT the whole-value `value.set` and WITHOUT
   * dying on rejection. Unlike `setDocumentRaw` (which reads the version, replaces
   * the entire document, and treats any rejection as a defect), this leaves
   * version handling and command construction to the caller and surfaces the raw
   * `{accepted, version, reason}` result so a version conflict
   * (`accepted: false`) can be retried by re-reading and re-reconciling. The
   * accepted batch is linearized and fanned out to live WS clients by the
   * document DO — this is the granular server-write path the paywall workspace
   * uses (never `setDocumentRaw`, which clobbers concurrent human edits).
   */
  submitTransaction(
    documentId: string,
    input: RawTransactionInput,
  ): Effect.Effect<RawTransactionResult, unknown> {
    const collectionId = this.id;
    return this.sdk.runEffect((client) => {
      const transactionId =
        input.id ??
        (typeof globalThis.crypto?.randomUUID === "function"
          ? globalThis.crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      return client.SubmitTransaction({
        collectionId,
        documentId,
        transaction: {
          id: transactionId,
          baseVersion: input.baseVersion,
          commands: input.commands as never,
        },
      }) as Effect.Effect<RawTransactionResult, unknown>;
    });
  }

  setupDocumentAuthentication(
    options: SetupDocumentAuthenticationOptions,
  ): Effect.Effect<DocumentAuthenticationSetup, unknown> {
    return this.sdk.runEffect(
      (client) =>
        client.SetupDocumentAuthentication({
          collectionId: this.id,
          documentId: options.documentId,
          permission: options.permission,
          origins: options.origins,
          expiresInSeconds: options.expiresInSeconds,
        }) as Effect.Effect<DocumentAuthenticationSetup, unknown>,
    );
  }
}
