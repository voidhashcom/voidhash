import { Rpc, RpcGroup } from "effect/unstable/rpc";
import { Schema } from "effect";

import {
  RpcAiChatAttachmentValidationError,
  RpcAiChatNotFoundError,
  RpcAiChatServiceError,
} from "../errors/AiChat.ts";
import { RpcActionForbiddenError } from "../errors/common.ts";
import { AuthMiddleware } from "../middlewares.ts";

/** Chat metadata as returned by the history list (no messages). */
export const AiChatSummarySchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  chatType: Schema.String,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
});

/** One full chat, including its JSON-encoded `UIMessage[]`. */
export const AiChatSchema = Schema.Struct({
  id: Schema.String,
  organizationId: Schema.String,
  projectId: Schema.String,
  surface: Schema.String,
  chatType: Schema.String,
  paywallId: Schema.NullOr(Schema.String),
  title: Schema.String,
  /** JSON-encoded AI SDK `UIMessage[]`. */
  messages: Schema.String,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
});

/** One stored chat attachment. */
export const AiChatAttachmentSchema = Schema.Struct({
  url: Schema.String,
  name: Schema.String,
  contentType: Schema.String,
  sizeBytes: Schema.Number,
});

/**
 * Voidhash AI chat persistence + attachments, gated by {@link AuthMiddleware}.
 * The chat id is minted client-side; `SaveAiChat` upserts by it. Reads/deletes
 * require org membership; writes additionally require access to the project.
 */
export class AiChatRpcsDef extends RpcGroup.make(
  Rpc.make("SaveAiChat", {
    error: Schema.Union([RpcAiChatServiceError, RpcActionForbiddenError]),
    payload: {
      id: Schema.String,
      organizationId: Schema.String,
      projectId: Schema.String,
      surface: Schema.String,
      /** "persistent" (listed, resumable) | "single_use" (stored, never listed). */
      chatType: Schema.String,
      paywallId: Schema.optional(Schema.String),
      title: Schema.String,
      /** JSON-encoded AI SDK `UIMessage[]`. */
      messages: Schema.String,
    },
    success: AiChatSummarySchema,
  }),
  Rpc.make("ListAiChats", {
    error: Schema.Union([RpcAiChatServiceError, RpcActionForbiddenError]),
    payload: {
      organizationId: Schema.String,
      projectId: Schema.String,
      surface: Schema.String,
      paywallId: Schema.optional(Schema.String),
    },
    success: Schema.Array(AiChatSummarySchema),
  }),
  Rpc.make("GetAiChat", {
    error: Schema.Union([RpcAiChatServiceError, RpcActionForbiddenError, RpcAiChatNotFoundError]),
    payload: {
      chatId: Schema.String,
    },
    success: AiChatSchema,
  }),
  Rpc.make("DeleteAiChat", {
    error: Schema.Union([RpcAiChatServiceError, RpcActionForbiddenError, RpcAiChatNotFoundError]),
    payload: {
      chatId: Schema.String,
    },
    success: Schema.Void,
  }),
  Rpc.make("UploadAiChatAttachment", {
    error: Schema.Union([
      RpcAiChatServiceError,
      RpcActionForbiddenError,
      RpcAiChatAttachmentValidationError,
    ]),
    payload: {
      chatId: Schema.String,
      organizationId: Schema.String,
      name: Schema.String,
      contentType: Schema.String,
      dataBase64: Schema.String,
    },
    success: AiChatAttachmentSchema,
  }),
  Rpc.make("RevertAiChatCheckpoint", {
    error: Schema.Union([RpcAiChatServiceError, RpcActionForbiddenError, RpcAiChatNotFoundError]),
    payload: {
      chatId: Schema.String,
    },
    // The number of documents reverted in the chat's last turn (`0` when the
    // chat has no checkpoints — a benign no-op the UI can treat as "nothing to
    // undo").
    success: Schema.Struct({ revertedDocuments: Schema.Number }),
  }),
  /**
   * Capture the current document tree of `paywallId` as the pre-turn image for a
   * chat turn, so a later {@link RpcGroup} `RevertAiChatCheckpoint` can restore
   * it. Called by the client at the START of an AI turn that will mutate the
   * document (before the model's `edit_document` ops land), in the
   * document-first authoring model where edits are applied incrementally.
   *
   * First-write-wins per `(chatId, turnId, paywallId)`: re-capturing the same
   * turn is a benign no-op (`captured: false`) so retries/reconnects don't clobber
   * the original pre-turn image. USER-session only.
   */
  Rpc.make("CaptureAiCheckpoint", {
    error: Schema.Union([RpcAiChatServiceError, RpcActionForbiddenError, RpcAiChatNotFoundError]),
    payload: {
      chatId: Schema.String,
      /** Stable per-turn id (matches the AI SDK turn) the checkpoint is keyed by. */
      turnId: Schema.String,
      /** The document whose current tree is captured as the pre-turn image. */
      paywallId: Schema.String,
    },
    // `captured: true` when this call took the checkpoint, `false` when one
    // already existed for the turn (first-write-wins no-op).
    success: Schema.Struct({ captured: Schema.Boolean }),
  }),
).middleware(AuthMiddleware) {}
