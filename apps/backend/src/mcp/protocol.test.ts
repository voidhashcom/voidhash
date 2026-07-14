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

const msg = (
  method: string,
  params?: Record<string, unknown>,
  id: string | number = 1,
): JsonRpcMessage => ({
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
      expect(result.capabilities).toEqual({ tools: {}, resources: {}, prompts: {} });
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
    expect(result.tools.length).toBe(13);
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

  it("preserves multimodal image content from preview tools", async () => {
    const content = [
      { type: "text" as const, text: '{"documentSignature":"doc-1"}' },
      { type: "image" as const, data: "iVBORw0KGgo=", mimeType: "image/png" as const },
    ];
    const response = await run(
      msg("tools/call", { name: "get_paywall_preview", arguments: {} }),
      cannedCallTool({ output: "preview", isError: false, content }),
    );
    expect((response as { result: { content: unknown } }).result.content).toEqual(content);
  });

  it("rejects a missing tool name with InvalidParams", async () => {
    const response = await run(msg("tools/call", { arguments: {} }));
    const error = (response as { error: { code: number } }).error;
    expect(error.code).toBe(JsonRpcErrorCode.InvalidParams);
  });
});

describe("resources", () => {
  it("lists and reads the schema-derived authoring guide", async () => {
    const listed = await run(msg("resources/list"));
    const resources = (listed as { result: { resources: Array<{ uri: string }> } }).result
      .resources;
    expect(resources[0]?.uri).toBe("voidhash://paywall-authoring/reference");

    const read = await run(
      msg("resources/read", { uri: "voidhash://paywall-authoring/reference" }),
    );
    const text = (read as { result: { contents: Array<{ text: string }> } }).result.contents[0]
      ?.text;
    expect(text).toContain("begin_paywall_edit");
    expect(text).toContain("Document model");
    expect(text).toContain("Variables, states, and actions");
    expect(text).toContain("selected_product");
  });
});

describe("prompts", () => {
  it("offers a design prompt with the verified lifecycle", async () => {
    const listed = await run(msg("prompts/list"));
    expect(
      (listed as { result: { prompts: Array<{ name: string }> } }).result.prompts[0]?.name,
    ).toBe("design_paywall");
    const response = await run(
      msg("prompts/get", {
        name: "design_paywall",
        arguments: { slug: "trial", request: "Improve hierarchy" },
      }),
    );
    const text = (
      response as {
        result: { messages: Array<{ content: { text: string } }> };
      }
    ).result.messages[0]?.content.text;
    expect(text).toContain('paywall "trial"');
    expect(text).toContain("get_paywall_preview");
    expect(text).toContain("dynamic behavior without code");
    expect(text).toContain("actionBindings");
    expect(text).toContain("Improve hierarchy");
  });
});

describe("unknown method", () => {
  it("returns method-not-found", async () => {
    const response = await run(msg("completion/complete"));
    const error = (response as { error: { code: number; message: string } }).error;
    expect(error.code).toBe(JsonRpcErrorCode.MethodNotFound);
    expect(error.message).toContain("completion/complete");
  });

  it("accepts an unknown notification silently", async () => {
    const response = await run({ jsonrpc: "2.0", method: "notifications/cancelled" });
    expect(response).toBeNull();
  });
});
