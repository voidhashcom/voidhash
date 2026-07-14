import { Cause, Effect } from "effect";
import { McpSchema, McpServer } from "effect/unstable/ai";

/** MCP protocol versions supported by Effect MCP, newest first. */
export const SUPPORTED_PROTOCOL_VERSIONS = [
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
  "2024-10-07",
] as const;

const LATEST_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];

/** Standard JSON-RPC 2.0 error codes emitted by the stateless adapter. */
export const JsonRpcErrorCode = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
} as const;

export type JsonRpcId = string | number | null;

/** A validated JSON-RPC request or notification. */
export interface JsonRpcMessage {
  readonly jsonrpc: "2.0";
  readonly method: string;
  readonly id?: JsonRpcId;
  readonly params?: Record<string, unknown>;
}

/** A JSON-RPC response returned over stateless streamable HTTP. */
export type JsonRpcResponse =
  | { readonly jsonrpc: "2.0"; readonly id: JsonRpcId; readonly result: unknown }
  | {
      readonly jsonrpc: "2.0";
      readonly id: JsonRpcId;
      readonly error: { readonly code: number; readonly message: string; readonly data?: unknown };
    };

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
): JsonRpcResponse => ({
  jsonrpc: "2.0",
  id,
  error: data === undefined ? { code, message } : { code, message, data },
});

/** Validates a parsed value as one non-batched JSON-RPC 2.0 message. */
export const parseJsonRpcMessage = (
  value: unknown,
):
  | { readonly ok: true; readonly message: JsonRpcMessage }
  | { readonly ok: false; readonly reason: string } => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
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

const negotiateProtocolVersion = (requested: unknown): string =>
  typeof requested === "string" &&
  (SUPPORTED_PROTOCOL_VERSIONS as ReadonlyArray<string>).includes(requested)
    ? requested
    : LATEST_PROTOCOL_VERSION;

const cleanFailure = (cause: Cause.Cause<unknown>): string =>
  Cause.prettyErrors(cause)[0]?.message ?? "Internal error";

const statelessClient = McpSchema.McpServerClient.of({
  clientId: 0,
  initializePayload: {
    protocolVersion: LATEST_PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: "stateless-http", version: "1" },
  },
  getClient: Effect.die(new Error("Stateless MCP does not support server-initiated requests")),
});

/**
 * Dispatches one MCP message through Effect MCP's registry without retaining a
 * transport session. Cloudflare Workers may route consecutive HTTP requests to
 * different isolates, so client capabilities are deliberately not stored in
 * isolate memory and every request remains independently executable.
 */
export const handleStatelessMcpMessage = (
  server: McpServer.McpServer["Service"],
  message: JsonRpcMessage,
  serverInfo: { readonly name: string; readonly version: string },
): Effect.Effect<JsonRpcResponse | null> => {
  const id = message.id ?? null;

  switch (message.method) {
    case "initialize": {
      const protocolVersion = negotiateProtocolVersion(message.params?.protocolVersion);
      return Effect.succeed(
        success(id, {
          protocolVersion,
          capabilities: {
            ...(server.tools.length > 0 ? { tools: { listChanged: false } } : {}),
            ...(server.resources.length > 0 || server.resourceTemplates.length > 0
              ? { resources: { subscribe: false, listChanged: false } }
              : {}),
          },
          serverInfo,
          instructions:
            "Use the focused paywall tools for authoring. Use platform_describe then platform_call for the rest of the typed platform API.",
        }),
      );
    }

    case "notifications/initialized":
      return Effect.succeed(null);

    case "ping":
      return Effect.succeed(success(id, {}));

    case "tools/list":
      return Effect.succeed(success(id, { tools: server.tools.map(({ tool }) => tool) }));

    case "tools/call": {
      const name = message.params?.name;
      if (typeof name !== "string" || name.length === 0) {
        return Effect.succeed(
          failure(id, JsonRpcErrorCode.InvalidParams, 'tools/call requires a string "name"'),
        );
      }
      const args = message.params?.arguments;
      if (
        args !== undefined &&
        (args === null || typeof args !== "object" || Array.isArray(args))
      ) {
        return Effect.succeed(
          failure(id, JsonRpcErrorCode.InvalidParams, 'tools/call "arguments" must be an object'),
        );
      }
      return server.callTool({ name, arguments: (args ?? {}) as Record<string, unknown> }).pipe(
        Effect.provideService(McpSchema.McpServerClient, statelessClient),
        Effect.map((result) => success(id, result)),
        Effect.catchCause((cause) =>
          Effect.succeed(failure(id, JsonRpcErrorCode.InvalidParams, cleanFailure(cause))),
        ),
      );
    }

    case "resources/list":
      return Effect.succeed(
        success(id, { resources: server.resources.map(({ resource }) => resource) }),
      );

    case "resources/templates/list":
      return Effect.succeed(
        success(id, {
          resourceTemplates: server.resourceTemplates.map(({ template }) => template),
        }),
      );

    case "resources/read": {
      const uri = message.params?.uri;
      if (typeof uri !== "string" || uri.length === 0) {
        return Effect.succeed(
          failure(id, JsonRpcErrorCode.InvalidParams, 'resources/read requires a string "uri"'),
        );
      }
      return server.findResource(uri).pipe(
        Effect.provideService(McpSchema.McpServerClient, statelessClient),
        Effect.map((result) => success(id, result)),
        Effect.catchCause((cause) =>
          Effect.succeed(failure(id, JsonRpcErrorCode.InvalidParams, cleanFailure(cause))),
        ),
      );
    }

    default:
      if (message.method.startsWith("notifications/") && message.id === undefined) {
        return Effect.succeed(null);
      }
      return Effect.succeed(
        failure(id, JsonRpcErrorCode.MethodNotFound, `Method not found: ${message.method}`),
      );
  }
};
