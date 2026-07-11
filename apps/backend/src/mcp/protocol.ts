/**
 * Minimal, hand-rolled MCP JSON-RPC 2.0 handler for the STATELESS streamable-HTTP
 * transport. No SDK dependency: a stateless server answers each `POST /api/mcp`
 * with a single JSON response (or 202 for a notification), which is spec-compliant
 * and exactly what Claude Code's streamable-HTTP client accepts.
 *
 * This module is transport- and auth-free: {@link handleMcpMessage} takes an
 * already-parsed JSON-RPC message plus a `callTool` executor (the route supplies
 * one bound to the authenticated project scope) and returns either a JSON-RPC
 * response object to serialize, or `null` for an accepted notification (the route
 * maps that to HTTP 202). Method dispatch, protocol-version negotiation, and the
 * error taxonomy live here so they can be unit-tested without a worker.
 *
 * Implemented methods: `initialize`, `notifications/initialized`, `tools/list`,
 * `tools/call`, `ping`. Unknown methods → JSON-RPC method-not-found. Tool errors
 * are `isError: true` content, never JSON-RPC errors (per MCP). Resources are not
 * offered this increment (tools cover the workflow).
 */
import { Effect } from "effect";

import { mcpToolDescriptors } from "./tool-manifest.ts";
import * as WorkspaceTools from "../ai/workspace-tools.ts";

/** Protocol versions we speak, newest first (used to pick the negotiated version). */
export const SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26"] as const;
const LATEST_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];

/** Server identity advertised in the `initialize` result. */
const SERVER_INFO = { name: "voidhash-paywall-workspace", version: "1.0.0" } as const;

/** Standard JSON-RPC 2.0 error codes we emit. */
export const JsonRpcErrorCode = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
} as const;

/** A JSON-RPC id (string or number, or null on a pre-id parse error). */
export type JsonRpcId = string | number | null;

/** A parsed JSON-RPC request/notification (validated by {@link parseJsonRpcMessage}). */
export interface JsonRpcMessage {
  readonly jsonrpc: "2.0";
  readonly method: string;
  readonly id?: JsonRpcId;
  readonly params?: Record<string, unknown>;
}

/** A JSON-RPC success/error response object to serialize back to the client. */
export type JsonRpcResponse =
  | { jsonrpc: "2.0"; id: JsonRpcId; result: unknown }
  | { jsonrpc: "2.0"; id: JsonRpcId; error: { code: number; message: string; data?: unknown } };

/** Executes a validated tool call against the authenticated scope. */
export type CallTool = (
  name: string,
  args: unknown,
) => Effect.Effect<WorkspaceTools.WorkspaceToolResult, never, WorkspaceTools.WorkspaceToolDeps>;

const success = (id: JsonRpcId, result: unknown): JsonRpcResponse => ({
  jsonrpc: "2.0",
  id,
  result,
});

const failure = (
  id: JsonRpcId,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcResponse => ({ jsonrpc: "2.0", id, error: data === undefined ? { code, message } : { code, message, data } });

/**
 * Validate an already-JSON-parsed value as a JSON-RPC 2.0 message. Returns the
 * narrowed message or an `InvalidRequest` reason (missing `jsonrpc`/`method`).
 * A notification is a message with no `id`.
 */
export const parseJsonRpcMessage = (
  value: unknown,
): { ok: true; message: JsonRpcMessage } | { ok: false; reason: string } => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    // Batches (arrays) are not supported by this stateless single-response server.
    return { ok: false, reason: "Expected a single JSON-RPC 2.0 request object" };
  }
  const record = value as Record<string, unknown>;
  if (record.jsonrpc !== "2.0") {
    return { ok: false, reason: 'Missing or invalid "jsonrpc": expected "2.0"' };
  }
  if (typeof record.method !== "string") {
    return { ok: false, reason: 'Missing or invalid "method"' };
  }
  const id = record.id;
  if (id !== undefined && id !== null && typeof id !== "string" && typeof id !== "number") {
    return { ok: false, reason: 'Invalid "id": expected string, number, or null' };
  }
  const params =
    record.params !== undefined && typeof record.params === "object" && record.params !== null
      ? (record.params as Record<string, unknown>)
      : undefined;
  return {
    ok: true,
    message: { jsonrpc: "2.0", method: record.method, id: id as JsonRpcId, params },
  };
};

/** Negotiate a protocol version: echo a supported one, else offer our latest. */
const negotiateProtocolVersion = (requested: unknown): string =>
  typeof requested === "string" &&
  (SUPPORTED_PROTOCOL_VERSIONS as ReadonlyArray<string>).includes(requested)
    ? requested
    : LATEST_PROTOCOL_VERSION;

/** The `initialize` result: negotiated version, tool capability, server identity. */
const initializeResult = (params: Record<string, unknown> | undefined) => ({
  protocolVersion: negotiateProtocolVersion(params?.protocolVersion),
  capabilities: { tools: {} },
  serverInfo: SERVER_INFO,
});

/** The `tools/list` result: the advertised tool descriptors. */
const toolsListResult = () => ({ tools: mcpToolDescriptors() });

/**
 * Handle a `tools/call`: read `name` + `arguments`, run the executor, and shape
 * the result as MCP content. A tool failure is `isError: true` content (never a
 * JSON-RPC error). A missing/invalid `name` is `InvalidParams` (a protocol
 * error, not a tool error). The executor never fails — the shared core folds
 * workspace failures into `{ isError }` — so this always resolves to a response.
 */
const handleToolsCall = (
  id: JsonRpcId,
  params: Record<string, unknown> | undefined,
  callTool: CallTool,
): Effect.Effect<JsonRpcResponse, never, WorkspaceTools.WorkspaceToolDeps> => {
  const name = params?.name;
  if (typeof name !== "string" || name.length === 0) {
    return Effect.succeed(
      failure(id, JsonRpcErrorCode.InvalidParams, 'tools/call requires a string "name"'),
    );
  }
  const args = params?.arguments ?? {};
  return callTool(name, args).pipe(
    Effect.map((result) =>
      success(id, {
        content: [{ type: "text", text: result.output }],
        isError: result.isError,
      }),
    ),
  );
};

/**
 * Dispatch one parsed JSON-RPC message. Returns a {@link JsonRpcResponse} to
 * serialize, or `null` for an accepted notification (`notifications/*`, id-less)
 * — the route answers those with HTTP 202 and an empty body.
 *
 * `callTool` runs a tool against the authenticated project scope; it (and this
 * effect) require the workspace/chat/auth context, provided by the route.
 */
export const handleMcpMessage = (
  message: JsonRpcMessage,
  callTool: CallTool,
): Effect.Effect<JsonRpcResponse | null, never, WorkspaceTools.WorkspaceToolDeps> => {
  const id: JsonRpcId = message.id ?? null;

  switch (message.method) {
    case "initialize":
      return Effect.succeed(success(id, initializeResult(message.params)));

    case "notifications/initialized":
      // Accepted notification: no response body (the route sends 202).
      return Effect.succeed(null);

    case "ping":
      // MCP ping → empty result.
      return Effect.succeed(success(id, {}));

    case "tools/list":
      return Effect.succeed(success(id, toolsListResult()));

    case "tools/call":
      return handleToolsCall(id, message.params, callTool);

    default: {
      // Any other `notifications/*` is an id-less message we accept silently.
      if (message.method.startsWith("notifications/") && message.id === undefined) {
        return Effect.succeed(null);
      }
      return Effect.succeed(
        failure(id, JsonRpcErrorCode.MethodNotFound, `Method not found: ${message.method}`),
      );
    }
  }
};
