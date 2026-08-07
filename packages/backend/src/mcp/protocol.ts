/**
 * Minimal, hand-rolled MCP JSON-RPC 2.0 handler for the STATELESS streamable-HTTP
 * transport. Editing state lives behind `editSessionId`; the transport itself
 * answers each `POST /api/mcp` with a single JSON response (or 202 for a
 * notification), which is spec-compliant and exactly what Claude Code's
 * streamable-HTTP client accepts.
 *
 * This module is transport- and auth-free: {@link handleMcpMessage} takes an
 * already-parsed JSON-RPC message plus a `callTool` executor (the route supplies
 * one bound to the authenticated project scope) and returns either a JSON-RPC
 * response object to serialize, or `null` for an accepted notification (the route
 * maps that to HTTP 202). Method dispatch, protocol-version negotiation, and the
 * error taxonomy live here so they can be unit-tested without a worker.
 *
 * Implemented methods: `initialize`, `notifications/initialized`, `tools/list`,
 * `tools/call`, `resources/list`, `resources/read`, `prompts/list`,
 * `prompts/get`, and `ping`. Unknown methods → JSON-RPC method-not-found. Tool
 * errors are `isError: true` content, never JSON-RPC errors (per MCP).
 */
import { constant } from "@voidhash/lib/lang";
import { Effect } from "effect";

import { mcpToolDescriptors } from "./tool-manifest.ts";
import * as WorkspaceTools from "../ai/workspace-tools.ts";
import {
  findSkill,
  listSkills,
  skillFromResourceUri,
  skillResourceUri,
} from "../ai/skills/registry.ts";

/** Protocol versions we speak, newest first (used to pick the negotiated version). */
export const SUPPORTED_PROTOCOL_VERSIONS = constant(["2025-06-18", "2025-03-26"]);
const LATEST_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];
const SUPPORTED_PROTOCOL_VERSION_LIST: ReadonlyArray<string> = SUPPORTED_PROTOCOL_VERSIONS;

/** Server identity advertised in the `initialize` result. */
const SERVER_INFO = constant({ name: "voidhash-paywall-workspace", version: "1.0.0" });
const AUTHORING_RESOURCE_URI = "voidhash://paywall-authoring/reference";
const DESIGN_PROMPT_NAME = "design_paywall";

const mcpAuthoringGuide = (): string => findSkill("paywall-authoring")?.body() ?? "";

/** Standard JSON-RPC 2.0 error codes we emit. */
export const JsonRpcErrorCode = constant({
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
});

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
): JsonRpcResponse => {
  if (data === undefined) {
    return { jsonrpc: "2.0", id, error: { code, message } };
  }
  return { jsonrpc: "2.0", id, error: { code, message, data } };
};

/**
 * Narrows an unknown value to an index-signature record. Mirrors the legacy
 * `typeof value === "object" && value !== null` check, so arrays pass too.
 */
const isObjectValue = (value: unknown): value is Record<string, unknown> => {
  if (value === null) return false;
  return typeof value === "object";
};

/** Validates the optional JSON-RPC `id` field, preserving "absent" as `undefined`. */
const parseJsonRpcId = (
  value: unknown,
): { ok: true; id: JsonRpcId | undefined } | { ok: false } => {
  if (value === undefined) return { ok: true, id: undefined };
  if (value === null) return { ok: true, id: null };
  if (typeof value === "string" || typeof value === "number") return { ok: true, id: value };
  return { ok: false };
};

const messageParams = (value: unknown): Record<string, unknown> | undefined => {
  if (isObjectValue(value)) return value;
  return undefined;
};

/**
 * Validate an already-JSON-parsed value as a JSON-RPC 2.0 message. Returns the
 * narrowed message or an `InvalidRequest` reason (missing `jsonrpc`/`method`).
 * A notification is a message with no `id`.
 */
export const parseJsonRpcMessage = (
  value: unknown,
): { ok: true; message: JsonRpcMessage } | { ok: false; reason: string } => {
  if (!isObjectValue(value) || Array.isArray(value)) {
    // Batches (arrays) are not supported by this stateless single-response server.
    return { ok: false, reason: "Expected a single JSON-RPC 2.0 request object" };
  }
  const record = value;
  if (record.jsonrpc !== "2.0") {
    return { ok: false, reason: 'Missing or invalid "jsonrpc": expected "2.0"' };
  }
  if (typeof record.method !== "string") {
    return { ok: false, reason: 'Missing or invalid "method"' };
  }
  const parsedId = parseJsonRpcId(record.id);
  if (!parsedId.ok) {
    return { ok: false, reason: 'Invalid "id": expected string, number, or null' };
  }
  return {
    ok: true,
    message: {
      jsonrpc: "2.0",
      method: record.method,
      id: parsedId.id,
      params: messageParams(record.params),
    },
  };
};

/** Negotiate a protocol version: echo a supported one, else offer our latest. */
const negotiateProtocolVersion = (requested: unknown): string => {
  if (typeof requested === "string" && SUPPORTED_PROTOCOL_VERSION_LIST.includes(requested)) {
    return requested;
  }
  return LATEST_PROTOCOL_VERSION;
};

/** The `initialize` result: negotiated version, tool capability, server identity. */
const initializeResult = (params: Record<string, unknown> | undefined) => ({
  protocolVersion: negotiateProtocolVersion(params?.protocolVersion),
  capabilities: { tools: {}, resources: {}, prompts: {} },
  serverInfo: SERVER_INFO,
  instructions:
    "Begin a paywall edit session before using scoped tools. The returned editSessionId is the connection handle. Prefer document variables, conditional states, and actions for dynamic behavior without code. Review the final PNG preview and finish with its exact document signature, or revert the session. Use the bash tool to research paywalls read-only before editing (`cat /README.md` for the layout).",
});

/** The `tools/list` result: the advertised tool descriptors. */
const toolsListResult = () => ({ tools: mcpToolDescriptors() });

const skillTitle = (name: string): string => {
  if (name === "paywall-authoring") return "Voidhash paywall authoring reference";
  return name;
};

const resourcesListResult = () => ({
  resources: listSkills().map((skill) => ({
    uri: skillResourceUri(skill.name),
    name: skill.name,
    title: skillTitle(skill.name),
    description: skill.description,
    mimeType: "text/markdown",
  })),
});

const promptsListResult = () => ({
  prompts: [
    {
      name: DESIGN_PROMPT_NAME,
      title: "Design a paywall",
      description:
        "Start a visually verified MCP paywall-authoring workflow with dynamic no-code behavior.",
      arguments: [
        { name: "paywallId", description: "Stable paywall id to edit.", required: true },
        { name: "request", description: "What to change or create.", required: false },
      ],
    },
  ],
});

/** Resolves the skill behind a `resources/read` URI (legacy alias included). */
const resolveSkillResource = (requestedUri: unknown) => {
  if (requestedUri === AUTHORING_RESOURCE_URI) return findSkill("paywall-authoring");
  if (typeof requestedUri === "string") return skillFromResourceUri(requestedUri);
  return undefined;
};

const promptArguments = (value: unknown): Record<string, unknown> => {
  if (isObjectValue(value)) return value;
  return {};
};

const requestedOutcome = (value: unknown): string => {
  if (typeof value === "string" && value.length > 0) return `\nRequested outcome: ${value}`;
  return "";
};

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
        content: result.content ?? [{ type: "text", text: result.output }],
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

    case "resources/list":
      return Effect.succeed(success(id, resourcesListResult()));

    case "resources/read": {
      const requestedUri = message.params?.uri;
      const skill = resolveSkillResource(requestedUri);
      if (skill === undefined || typeof requestedUri !== "string") {
        return Effect.succeed(
          failure(id, JsonRpcErrorCode.InvalidParams, "Unknown skill resource URI"),
        );
      }
      return Effect.succeed(
        success(id, {
          contents: [
            {
              uri: requestedUri,
              mimeType: "text/markdown",
              text: skill.body(),
            },
          ],
        }),
      );
    }

    case "prompts/list":
      return Effect.succeed(success(id, promptsListResult()));

    case "prompts/get": {
      if (message.params?.name !== DESIGN_PROMPT_NAME) {
        return Effect.succeed(
          failure(id, JsonRpcErrorCode.InvalidParams, "Unknown paywall authoring prompt"),
        );
      }
      const args = promptArguments(message.params.arguments);
      const paywallId = args.paywallId;
      if (typeof paywallId !== "string" || paywallId.length === 0) {
        return Effect.succeed(
          failure(
            id,
            JsonRpcErrorCode.InvalidParams,
            'design_paywall requires a string "paywallId"',
          ),
        );
      }
      const request = requestedOutcome(args.request);
      return Effect.succeed(
        success(id, {
          description: `Design paywall ${paywallId} with a visually verified edit session.`,
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `Design paywall "${paywallId}" using the Voidhash MCP workflow.${request}\n\n${mcpAuthoringGuide()}`,
              },
            },
          ],
        }),
      );
    }

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
