import type { PreviewScreenshotToolOutput, Surface } from "@voidhash/ai-shared";

/** Whether a chat is listed in the history UI, or stored-but-hidden. */
export type AiChatType = "persistent" | "single_use";

/**
 * One client-executed tool call handed to a {@link SurfaceAgent.executeTool}
 * seam. `input` is the model's raw argument object (the executor validates it
 * against the shared tool schema); `toolName` selects the tool. `chatId` +
 * `turnId` (the id of the current user turn — the last user message) identify the
 * chat turn the designer's first mutating tool threads to the server for
 * checkpoint capture.
 */
export interface SurfaceToolCall {
  toolName: string;
  toolCallId: string;
  input: unknown;
  chatId: string;
  turnId?: string;
}

/**
 * The result an executor folds every tool call into: model-facing text or the
 * structured screenshot payload, plus whether it represents an error. Executors
 * NEVER throw into the AI SDK: a failure is folded into
 * `{ output, isError: true }` so the model sees a readable message and can recover.
 */
export interface SurfaceToolResult {
  output: string | PreviewScreenshotToolOutput;
  isError: boolean;
}

/** Coarse chat activity exposed to a host surface for ambient progress UI. */
export type SurfaceAgentActivity = { kind: "thinking"; label: string } | { kind: "idle" };

/**
 * How a surface's chats are persisted. `persistent` chats appear in the history
 * dropdown and can be reopened; `single_use` chats are still stored (for
 * audit/debug) but never listed. Omit to make a surface's chats ephemeral —
 * they are still saved as `single_use`.
 */
export interface SurfaceChatPersistence {
  chatType: AiChatType;
}

/**
 * Everything a chat surface contributes to the shared chat core: which surface
 * it is, the request context sent with every message, how its chats persist, and
 * (for surfaces with client tools) how to execute a tool call.
 *
 * The designer surface's tools are CLIENT-EXECUTED: the backend declares them
 * schema-only, so the model calling a tool ends the SSE stream; the browser runs
 * {@link SurfaceAgent.executeTool} against the live local document and the chat
 * auto-continues (AI SDK v5 client-tool round-trip). A surface with no client
 * tools omits `executeTool` and remains a pure chat UI.
 */
export interface SurfaceAgent {
  surfaceId: Surface;
  /** Extra request context sent with each chat request. */
  context: { organizationId: string; projectId: string; paywallId?: string };
  /**
   * Executes one client-side tool call and resolves a model-facing result. The
   * chat core wires this to the AI SDK's `onToolCall` → `addToolResult` and
   * auto-continues the conversation. Executors MUST NOT throw — a failure is
   * folded into `{ output, isError: true }`. Omit for a surface with no client
   * tools (server-only tools or none).
   */
  executeTool?: (call: SurfaceToolCall) => Promise<SurfaceToolResult>;
  /**
   * Extra request context resolved fresh at SEND time (merged into the body per
   * turn, overriding {@link SurfaceAgent.context}). Use for live UI state that
   * must reflect the moment the user hit send — e.g. the designer's current
   * selection — rather than the values at hook-mount time. Omit if the surface
   * has none.
   */
  getDynamicContext?: () => Record<string, unknown>;
  /**
   * Awaited immediately before each send's POST (inside the transport's
   * `prepareSendMessagesRequest`). Use to flush live UI state the server must see
   * with THIS turn — e.g. the designer draining its code-editor flush queue so the
   * agent reads the user's latest code. Rejections are swallowed (a failed flush
   * must not block the message). Omit if the surface has none.
   */
  beforeSend?: () => Promise<void> | void;
  /** Receives coarse turn activity so the host can visualize agent progress outside chat. */
  onActivityChange?: (activity: SurfaceAgentActivity) => void;
  /** Persistence policy for this surface's chats. Defaults to `single_use`. */
  persistence?: SurfaceChatPersistence;
}
