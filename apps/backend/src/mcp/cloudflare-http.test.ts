import { Context, Effect } from "effect";
import { McpSchema, McpServer } from "effect/unstable/ai";
import { describe, expect, it } from "vite-plus/test";

import {
  handleStatelessMcpMessage,
  JsonRpcErrorCode,
  parseJsonRpcMessage,
  SUPPORTED_PROTOCOL_VERSIONS,
  type JsonRpcMessage,
  type JsonRpcResponse,
} from "./cloudflare-http.ts";

const serverInfo = { name: "test", version: "1.0.0" } as const;

const makeServer = () =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const server = yield* McpServer.McpServer.make;
        yield* server.addTool({
          tool: new McpSchema.Tool({
            name: "echo",
            description: "Echo input",
            inputSchema: { type: "object" },
          }),
          annotations: Context.empty(),
          handle: (input) =>
            Effect.succeed(
              new McpSchema.CallToolResult({
                content: [{ type: "text", text: JSON.stringify(input) }],
                structuredContent: input,
                isError: false,
              }),
            ),
        });
        yield* server.addResource({
          resource: new McpSchema.Resource({
            uri: "voidhash://test",
            name: "Test resource",
            mimeType: "text/plain",
          }),
          annotations: Context.empty(),
          handle: Effect.succeed({
            contents: [{ uri: "voidhash://test", mimeType: "text/plain", text: "ready" }],
          }),
        });
        yield* server.addResourceTemplate({
          template: new McpSchema.ResourceTemplate({
            uriTemplate: "voidhash://widgets/{id}",
            name: "Widget",
            mimeType: "application/json",
          }),
          routerPath: "voidhash:://widgets/:0",
          completions: {},
          annotations: Context.empty(),
          handle: (uri, params) =>
            Effect.succeed({
              contents: [
                { uri, mimeType: "application/json", text: JSON.stringify({ id: params[0] }) },
              ],
            }),
        });
        return server;
      }),
    ),
  );

const msg = (
  method: string,
  params?: Record<string, unknown>,
  id: string | number = 1,
): JsonRpcMessage => ({ jsonrpc: "2.0", method, params, id });

const resultOf = (response: JsonRpcResponse | null): unknown =>
  response !== null && "result" in response ? response.result : undefined;

describe("parseJsonRpcMessage", () => {
  it("accepts a request and rejects batches", () => {
    expect(parseJsonRpcMessage({ jsonrpc: "2.0", method: "ping", id: 1 }).ok).toBe(true);
    expect(parseJsonRpcMessage([{ jsonrpc: "2.0", method: "ping", id: 1 }]).ok).toBe(false);
  });
});

describe("Cloudflare stateless MCP transport", () => {
  it("initializes and calls tools without retaining or requiring an MCP session id", async () => {
    const server = await makeServer();
    const initialized = await Effect.runPromise(
      handleStatelessMcpMessage(
        server,
        msg("initialize", {
          protocolVersion: SUPPORTED_PROTOCOL_VERSIONS[0],
          capabilities: {},
          clientInfo: { name: "test", version: "1" },
        }),
        serverInfo,
      ),
    );
    expect(resultOf(initialized)).toMatchObject({
      protocolVersion: SUPPORTED_PROTOCOL_VERSIONS[0],
      capabilities: { tools: {}, resources: {} },
    });

    const called = await Effect.runPromise(
      handleStatelessMcpMessage(
        server,
        msg("tools/call", { name: "echo", arguments: { value: 42 } }, 2),
        serverInfo,
      ),
    );
    expect(resultOf(called)).toMatchObject({
      structuredContent: { value: 42 },
      isError: false,
    });
  });

  it("discovers Effect MCP tools and resources", async () => {
    const server = await makeServer();
    const tools = await Effect.runPromise(
      handleStatelessMcpMessage(server, msg("tools/list"), serverInfo),
    );
    expect(resultOf(tools)).toMatchObject({ tools: [{ name: "echo" }] });

    const resources = await Effect.runPromise(
      handleStatelessMcpMessage(server, msg("resources/list"), serverInfo),
    );
    expect(resultOf(resources)).toMatchObject({ resources: [{ uri: "voidhash://test" }] });

    const templates = await Effect.runPromise(
      handleStatelessMcpMessage(server, msg("resources/templates/list"), serverInfo),
    );
    expect(resultOf(templates)).toMatchObject({
      resourceTemplates: [{ uriTemplate: "voidhash://widgets/{id}" }],
    });

    const read = await Effect.runPromise(
      handleStatelessMcpMessage(
        server,
        msg("resources/read", { uri: "voidhash://test" }),
        serverInfo,
      ),
    );
    expect(resultOf(read)).toMatchObject({ contents: [{ text: "ready" }] });

    const templated = await Effect.runPromise(
      handleStatelessMcpMessage(
        server,
        msg("resources/read", { uri: "voidhash://widgets/42" }),
        serverInfo,
      ),
    );
    expect(resultOf(templated)).toMatchObject({ contents: [{ text: '{"id":"42"}' }] });
  });

  it("returns protocol errors for invalid params and unknown methods", async () => {
    const server = await makeServer();
    const invalid = await Effect.runPromise(
      handleStatelessMcpMessage(server, msg("tools/call", {}), serverInfo),
    );
    expect(invalid && "error" in invalid ? invalid.error.code : null).toBe(
      JsonRpcErrorCode.InvalidParams,
    );

    const unknown = await Effect.runPromise(
      handleStatelessMcpMessage(server, msg("unknown/method"), serverInfo),
    );
    expect(unknown && "error" in unknown ? unknown.error.code : null).toBe(
      JsonRpcErrorCode.MethodNotFound,
    );
  });
});
