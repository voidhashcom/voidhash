/**
 * Unit tests for the hand-rolled MCP JSON-RPC handler. The tool executor is
 * mocked (a context-free `callTool`), so these cover method dispatch, protocol
 * negotiation, the tools/list shape, and the tool-error → `isError` mapping
 * without a worker or the workspace service.
 */
import { constant } from "@voidhash/lib/lang";
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

/**
 * Run the handler with a canned executor and no real context (protocol-only).
 *
 * The overload declares the context-free effect this call actually produces:
 * the canned executor closes over no services, so the handler's declared
 * workspace requirement is vacuous here.
 */
function run(message: JsonRpcMessage, callTool?: CallTool): Effect.Effect<JsonRpcResponse | null>;
function run(
  message: JsonRpcMessage,
  callTool: CallTool = cannedCallTool({ output: "ok", isError: false }),
) {
  return handleMcpMessage(message, callTool);
}

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** Reads a response's `result` payload as a record, dying if it is shaped otherwise. */
const resultOf = (response: JsonRpcResponse | null): Effect.Effect<Record<string, unknown>> =>
  Effect.gen(function* () {
    if (response === null || !("result" in response) || !isRecord(response.result)) {
      return yield* Effect.die(new Error("expected a JSON-RPC success response with a record result"));
    }
    return response.result;
  });

/** Reads a response's JSON-RPC `error` object, dying if the response is a success. */
const errorOf = (
  response: JsonRpcResponse | null,
): Effect.Effect<{ code: number; message: string; data?: unknown }> =>
  Effect.gen(function* () {
    if (response === null || !("error" in response)) {
      return yield* Effect.die(new Error("expected a JSON-RPC error response"));
    }
    return response.error;
  });

/** Reads an unknown payload field as an array of records. */
const recordsOf = (value: unknown): Effect.Effect<Array<Record<string, unknown>>> =>
  Effect.gen(function* () {
    if (!Array.isArray(value)) {
      return yield* Effect.die(new Error(`expected an array, got ${String(value)}`));
    }
    return value;
  });

/** Reads an unknown payload field as a record. */
const recordOf = (value: unknown): Effect.Effect<Record<string, unknown>> =>
  Effect.gen(function* () {
    if (!isRecord(value)) {
      return yield* Effect.die(new Error(`expected an object, got ${String(value)}`));
    }
    return value;
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
  it("negotiates the requested supported version and advertises tools", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        for (const version of SUPPORTED_PROTOCOL_VERSIONS) {
          const response = yield* run(msg("initialize", { protocolVersion: version }));
          expect(response !== null && "result" in response).toBe(true);
          const result = yield* resultOf(response);
          expect(result.protocolVersion).toBe(version);
          expect(result.capabilities).toEqual({ tools: {}, resources: {}, prompts: {} });
          const serverInfo = yield* recordOf(result.serverInfo);
          expect(serverInfo.name).toBe("voidhash-paywall-workspace");
        }
      }),
    ));

  it("falls back to the latest version for an unsupported request", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const response = yield* run(msg("initialize", { protocolVersion: "1999-01-01" }));
        const result = yield* resultOf(response);
        expect(result.protocolVersion).toBe(SUPPORTED_PROTOCOL_VERSIONS[0]);
      }),
    ));
});

describe("notifications/initialized", () => {
  it("is accepted with no response (route → 202)", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const response = yield* run({ jsonrpc: "2.0", method: "notifications/initialized" });
        expect(response).toBeNull();
      }),
    ));
});

describe("ping", () => {
  it("returns an empty result", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const response = yield* run(msg("ping"));
        const result = yield* resultOf(response);
        expect(result).toEqual({});
      }),
    ));
});

describe("tools/list", () => {
  it("returns the tool descriptors with JSON Schema inputs", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const response = yield* run(msg("tools/list"));
        const result = yield* resultOf(response);
        const tools = yield* recordsOf(result.tools);
        expect(tools.length).toBe(14);
        const listPaywalls = yield* recordOf(tools[0]);
        expect(listPaywalls.name).toBe("list_paywalls");
        const inputSchema = yield* recordOf(listPaywalls.inputSchema);
        expect(inputSchema.type).toBe("object");
      }),
    ));
});

describe("tools/call", () => {
  it("maps a successful tool run to text content (isError false)", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const response = yield* run(
          msg("tools/call", { name: "read_file", arguments: { path: "/x" } }),
          cannedCallTool({ output: "FILE", isError: false }),
        );
        const result = yield* resultOf(response);
        expect(result.isError).toBe(false);
        expect(result.content).toEqual([{ type: "text", text: "FILE" }]);
      }),
    ));

  it("maps a tool failure to isError content, NOT a JSON-RPC error", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const response = yield* run(
          msg("tools/call", { name: "apply_paywall", arguments: {} }),
          cannedCallTool({ output: "apply_paywall rejected: bad", isError: true }),
        );
        expect(response !== null && "result" in response).toBe(true);
        const result = yield* resultOf(response);
        expect(result.isError).toBe(true);
        expect(result.content).toEqual([{ type: "text", text: "apply_paywall rejected: bad" }]);
      }),
    ));

  it("preserves multimodal image content from preview tools", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const content = constant([
          { type: "text", text: '{"documentSignature":"doc-1"}' },
          { type: "image", data: "iVBORw0KGgo=", mimeType: "image/png" },
        ]);
        const response = yield* run(
          msg("tools/call", { name: "get_paywall_preview", arguments: {} }),
          cannedCallTool({ output: "preview", isError: false, content }),
        );
        const result = yield* resultOf(response);
        expect(result.content).toEqual(content);
      }),
    ));

  it("rejects a missing tool name with InvalidParams", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const response = yield* run(msg("tools/call", { arguments: {} }));
        const error = yield* errorOf(response);
        expect(error.code).toBe(JsonRpcErrorCode.InvalidParams);
      }),
    ));
});

describe("resources", () => {
  it("lists and reads both authoring skills", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const listed = yield* run(msg("resources/list"));
        const listedResult = yield* resultOf(listed);
        const resources = yield* recordsOf(listedResult.resources);
        expect(resources[0]?.uri).toBe("voidhash://skills/paywall-authoring");
        expect(resources[1]?.uri).toBe("voidhash://skills/code-component-authoring");

        const read = yield* run(
          msg("resources/read", { uri: "voidhash://skills/paywall-authoring" }),
        );
        const readResult = yield* resultOf(read);
        const contents = yield* recordsOf(readResult.contents);
        const text = contents[0]?.text;
        expect(text).toContain("begin_paywall_edit");
        expect(text).toContain("Document model");
        expect(text).toContain("Variables, states, and actions");
        expect(text).toContain("selected_product");

        const componentRead = yield* run(
          msg("resources/read", { uri: "voidhash://skills/code-component-authoring" }),
        );
        const componentResult = yield* resultOf(componentRead);
        const componentContents = yield* recordsOf(componentResult.contents);
        const componentText = componentContents[0]?.text;
        expect(componentText).toContain("Custom designer panels");
        expect(componentText).toContain("Runtime animation and gestures");
        expect(componentText).toContain("useMotionValue");
      }),
    ));
});

describe("prompts", () => {
  it("offers a design prompt with the verified lifecycle", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const listed = yield* run(msg("prompts/list"));
        const listedResult = yield* resultOf(listed);
        const prompts = yield* recordsOf(listedResult.prompts);
        expect(prompts[0]?.name).toBe("design_paywall");

        const response = yield* run(
          msg("prompts/get", {
            name: "design_paywall",
            arguments: { paywallId: "pw_1", request: "Improve hierarchy" },
          }),
        );
        const result = yield* resultOf(response);
        const messages = yield* recordsOf(result.messages);
        const content = yield* recordOf(messages[0]?.content);
        const text = content.text;
        expect(text).toContain('paywall "pw_1"');
        expect(text).toContain("get_paywall_preview");
        expect(text).toContain("dynamic behavior without code");
        expect(text).toContain("actionBindings");
        expect(text).toContain("Improve hierarchy");
      }),
    ));
});

describe("unknown method", () => {
  it("returns method-not-found", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const response = yield* run(msg("completion/complete"));
        const error = yield* errorOf(response);
        expect(error.code).toBe(JsonRpcErrorCode.MethodNotFound);
        expect(error.message).toContain("completion/complete");
      }),
    ));

  it("accepts an unknown notification silently", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const response = yield* run({ jsonrpc: "2.0", method: "notifications/cancelled" });
        expect(response).toBeNull();
      }),
    ));
});
