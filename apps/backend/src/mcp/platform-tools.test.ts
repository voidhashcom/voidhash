import { AuthSession } from "@voidhash/core/domain/auth/Auth";
import { AuthMiddleware, RpcGroups } from "@voidhash/rpc";
import { Effect, Schema } from "effect";
import { McpServer } from "effect/unstable/ai";
import { Rpc, RpcGroup } from "effect/unstable/rpc";
import { describe, expect, it } from "vite-plus/test";

import { handleStatelessMcpMessage, type JsonRpcResponse } from "./cloudflare-http.ts";
import { makePlatformOperations, registerPlatformTools } from "./platform-tools.ts";

const TestRpcs = RpcGroup.make(
  Rpc.make("ListWidgets", {
    payload: { projectId: Schema.String },
    success: Schema.Array(Schema.Struct({ id: Schema.String })),
  }),
  Rpc.make("DeleteWidget", {
    payload: { id: Schema.String },
    success: Schema.Void,
  }),
  Rpc.make("CurrentWidget", {
    success: Schema.Struct({ projectId: Schema.String }),
  }),
).middleware(AuthMiddleware);

const TestHandlers = TestRpcs.toLayer({
  ListWidgets: ({ projectId }) =>
    AuthSession.use((session) =>
      Effect.succeed([{ id: `${session.projects[0]?.id ?? "none"}:${projectId}` }]),
    ),
  DeleteWidget: () => Effect.void,
  CurrentWidget: () =>
    AuthSession.use((session) => Effect.succeed({ projectId: session.projects[0]?.id ?? "none" })),
});

const session = AuthSession.of({
  cookie: null,
  method: "secret-key",
  name: "Test key",
  organizations: [],
  person: null,
  projects: [
    {
      id: "project-from-auth",
      logo: null,
      name: "Test",
      organizationId: "org-1",
      permissions: ["project:all"],
      slug: "test",
    },
  ],
  user: null,
});

const makePlatformServer = () =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const server = yield* McpServer.McpServer.make;
        const operations = yield* makePlatformOperations(TestRpcs);
        yield* registerPlatformTools(server, operations);
        return { server, operations };
      }).pipe(Effect.provide(TestHandlers)),
    ),
  );

const resultOf = (response: JsonRpcResponse | null): Record<string, unknown> =>
  (response !== null && "result" in response ? response.result : {}) as Record<string, unknown>;

describe("platform MCP gateway", () => {
  it("builds a unique, JSON-schema-described operation for every composed platform RPC", async () => {
    const handlers = Object.fromEntries(
      Array.from(RpcGroups.requests.keys(), (tag) => [tag, () => Effect.void]),
    );
    const operations = await Effect.runPromise(
      Effect.scoped(
        makePlatformOperations(RpcGroups).pipe(
          Effect.provide(RpcGroups.toLayer(handlers as never)),
        ),
      ),
    );

    expect(operations).toHaveLength(RpcGroups.requests.size);
    expect(new Set(operations.map(({ name }) => name)).size).toBe(RpcGroups.requests.size);
    expect(
      operations
        .filter(({ inputSchema }) => typeof inputSchema !== "object" || inputSchema === null)
        .map(({ name }) => name),
    ).toEqual([]);
  });

  it("derives stable operation names, input schemas, and safety annotations from RPCs", async () => {
    const { operations } = await makePlatformServer();
    expect(operations.map(({ name }) => name)).toEqual([
      "list_widgets",
      "delete_widget",
      "current_widget",
    ]);
    expect(operations[0]?.inputSchema).toMatchObject({
      type: "object",
      properties: { projectId: { type: "string" } },
    });
    expect(operations[0]?.annotations).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
    });
    expect(operations[1]?.annotations.destructiveHint).toBe(true);
  });

  it("describes and executes a typed RPC through Effect MCP with the request session", async () => {
    const { server } = await makePlatformServer();
    const described = await Effect.runPromise(
      handleStatelessMcpMessage(
        server,
        {
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: {
            name: "platform_describe",
            arguments: { operation: "list_widgets" },
          },
        },
        { name: "test", version: "1" },
      ).pipe(Effect.provideService(AuthSession, session)),
    );
    expect(resultOf(described).structuredContent).toMatchObject({
      operations: [{ name: "list_widgets", rpc: "ListWidgets" }],
      total: 1,
    });

    const called = await Effect.runPromise(
      handleStatelessMcpMessage(
        server,
        {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: {
            name: "platform_call",
            arguments: {
              operation: "list_widgets",
              input: { projectId: "project-from-input" },
            },
          },
        },
        { name: "test", version: "1" },
      ).pipe(Effect.provideService(AuthSession, session)),
    );
    expect(resultOf(called).structuredContent).toEqual([
      { id: "project-from-auth:project-from-input" },
    ]);

    const calledWithoutInput = await Effect.runPromise(
      handleStatelessMcpMessage(
        server,
        {
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: {
            name: "platform_call",
            arguments: { operation: "current_widget" },
          },
        },
        { name: "test", version: "1" },
      ).pipe(Effect.provideService(AuthSession, session)),
    );
    expect(resultOf(calledWithoutInput).structuredContent).toEqual({
      projectId: "project-from-auth",
    });
  });

  it("folds schema validation failures into an MCP tool error", async () => {
    const { server } = await makePlatformServer();
    const response = await Effect.runPromise(
      handleStatelessMcpMessage(
        server,
        {
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: {
            name: "platform_call",
            arguments: { operation: "list_widgets", input: {} },
          },
        },
        { name: "test", version: "1" },
      ).pipe(Effect.provideService(AuthSession, session)),
    );
    expect(resultOf(response)).toMatchObject({ isError: true });
  });

  it("folds malformed gateway arguments into MCP tool errors", async () => {
    const { server } = await makePlatformServer();
    const response = await Effect.runPromise(
      handleStatelessMcpMessage(
        server,
        {
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "platform_describe", arguments: { query: 42 } },
        },
        { name: "test", version: "1" },
      ),
    );
    expect(resultOf(response)).toMatchObject({ isError: true });
  });
});
