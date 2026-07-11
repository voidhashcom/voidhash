/**
 * Voidhash AI chat errors — typed errors returned by AI-chat RPCs. Class names
 * and `_tag` values are namespaced with `Rpc` / `Rpc/`.
 */
import { Schema } from "effect";

/** Catch-all service failure (db / storage). */
export class RpcAiChatServiceError extends Schema.TaggedErrorClass<RpcAiChatServiceError>(
  "RpcAiChatServiceError",
)("Rpc/AiChatServiceError", { message: Schema.String }) {}

/** Referenced chat row not found. */
export class RpcAiChatNotFoundError extends Schema.TaggedErrorClass<RpcAiChatNotFoundError>(
  "RpcAiChatNotFoundError",
)("Rpc/AiChatNotFoundError", { chatId: Schema.String }) {}

/** Uploaded attachment failed image validation (unsupported type, too large, or malformed). */
export class RpcAiChatAttachmentValidationError extends Schema.TaggedErrorClass<RpcAiChatAttachmentValidationError>(
  "RpcAiChatAttachmentValidationError",
)("Rpc/AiChatAttachmentValidationError", { message: Schema.String }) {}
