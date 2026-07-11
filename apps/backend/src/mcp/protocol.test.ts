/**
 * Unit tests for the hand-rolled MCP JSON-RPC handler. The tool executor is
 * mocked (a context-free `callTool`), so these cover method dispatch, protocol
 * negotiation, the tools/list shape, and the tool-error → `isError` mapping
 * without a worker or the workspace service.
 */
import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";

import {
  handleMcpMessage,
  parseJsonRpcMessage,
  JsonRpcErrorCode,
  SUPPORTED_PROTOCOL_VERSIONS,
  type CallTool,
  type JsonRpcMessage,
  type JsonRpcResponse,
} from "./protocol.ts";
import type { WorkspaceToolResult } from "../ai/workspace-tools.ts";

/** A canned tool executor: echoes the name/args, or fails as an `isError` result. */
const cannedCallTool =
  (result: WorkspaceToolResult): CallTool =>
  () =>
    Effect.succeed(result);

/** Run the handler with a canned executor and no real context (protocol-only). */
const run = (
  message: JsonRpcMessage,
  callTool: CallTool = cannedCallTool({ output: "ok", isError: false }),
): Promise<JsonRpcResponse | null> =>
  Effect.runPromise(handleMcpMessage(message, callTool) as Effect.Effect<JsonRpcResponse | null>);

const msg = (method: string, params?: Record<string, unknown>, id: string | number = 1): JsonRpcMessage => ({
  jsonrpc: "2.0",
  method,
  id,
  params,
});

describe("parseJsonRpcMessage", () => {
  it("accepts a valid request", () => {
    const parsed = parseJsonRpcMessage({ jsonrpc: "2.0", method: "ping", id: 1 });
    expect(parsed.ok).toBe(true);
  });

  it("rejects a missing jsonrpc version", () => {
    const parsed = parseJsonRpcMessage({ method: "ping", id: 1 });
    expect(parsed.ok).toBe(false);
  });

  it("rejects a missing method", () => {
    const parsed = parseJsonRpcMessage({ jsonrpc: "2.0", id: 1 });
    expect(parsed.ok).toBe(false);
  });

  it("rejects a batch (array)", () => {
    const parsed = parseJsonRpcMessage([{ jsonrpc: "2.0", method: "ping", id: 1 }]);
    expect(parsed.ok).toBe(false);
  });
});

describe("initialize", () => {
  it("negotiates the requested supported version and advertises tools", async () => {
    for (const version of SUPPORTED_PROTOCOL_VERSIONS) {
      const response = await run(msg("initialize", { protocolVersion: version }));
      expect(response && "result" in response).toBe(true);
      const result = (response as { result: Record<string, unknown> }).result;
      expect(result.protocolVersion).toBe(version);
      expect(result.capabilities).toEqual({ tools: {} });
      expect((result.serverInfo as { name: string }).name).toBe("voidhash-paywall-workspace");
    }
  });

  it("falls back to the latest version for an unsupported request", async () => {
    const response = await run(msg("initialize", { protocolVersion: "1999-01-01" }));
    const result = (response as { result: Record<string, unknown> }).result;
    expect(result.protocolVersion).toBe(SUPPORTED_PROTOCOL_VERSIONS[0]);
  });
});

describe("notifications/initialized", () => {
  it("is accepted with no response (route → 202)", async () => {
    const response = await run({ jsonrpc: "2.0", method: "notifications/initialized" });
    expect(response).toBeNull();
  });
});

describe("ping", () => {
  it("returns an empty result", async () => {
    const response = await run(msg("ping"));
    expect((response as { result: unknown }).result).toEqual({});
  });
});

describe("tools/list", () => {
  it("returns the tool descriptors with JSON Schema inputs", async () => {
    const response = await run(msg("tools/list"));
    const result = (response as { result: { tools: Array<Record<string, unknown>> } }).result;
    expect(result.tools.length).toBe(8);
    const listPaywalls = result.tools[0];
    expect(listPaywalls.name).toBe("list_paywalls");
    expect((listPaywalls.inputSchema as { type: string }).type).toBe("object");
  });
});

describe("tools/call", () => {
  it("maps a successful tool run to text content (isError false)", async () => {
    const response = await run(
      msg("tools/call", { name: "read_file", arguments: { path: "/x" } }),
      cannedCallTool({ output: "FILE", isError: false }),
    );
    const result = (response as { result: Record<string, unknown> }).result;
    expect(result.isError).toBe(false);
    expect(result.content).toEqual([{ type: "text", text: "FILE" }]);
  });

  it("maps a tool failure to isError content, NOT a JSON-RPC error", async () => {
    const response = await run(
      msg("tools/call", { name: "apply_paywall", arguments: {} }),
      cannedCallTool({ output: "apply_paywall rejected: bad", isError: true }),
    );
    expect(response && "result" in response).toBe(true);
    const result = (response as { result: Record<string, unknown> }).result;
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: "text", text: "apply_paywall rejected: bad" }]);
  });

  it("rejects a missing tool name with InvalidParams", async () => {
    const response = await run(msg("tools/call", { arguments: {} }));
    const error = (response as { error: { code: number } }).error;
    expect(error.code).toBe(JsonRpcErrorCode.InvalidParams);
  });
});

describe("unknown method", () => {
  it("returns method-not-found", async () => {
    const response = await run(msg("resources/list"));
    const error = (response as { error: { code: number; message: string } }).error;
    expect(error.code).toBe(JsonRpcErrorCode.MethodNotFound);
    expect(error.message).toContain("resources/list");
  });

  it("accepts an unknown notification silently", async () => {
    const response = await run({ jsonrpc: "2.0", method: "notifications/cancelled" });
    expect(response).toBeNull();
  });
});
