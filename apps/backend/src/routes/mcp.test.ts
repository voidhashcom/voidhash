import { ApiKeyNotFoundError } from "@voidhash/core/domain/apiKey/ApiKey";
import { AuthSession } from "@voidhash/core/domain/auth/Auth";
import { ApiKeyService, LocalUserSessionService } from "@voidhash/core/services";
import { Db } from "@voidhash/db";
import { AuthMiddleware } from "@voidhash/rpc";
import { Effect, Layer, Schema } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { Rpc, RpcGroup } from "effect/unstable/rpc";
import { describe, expect, it } from "vite-plus/test";

import { McpRouteLayer } from "./mcp.ts";

const TestRpcs = RpcGroup.make(
  Rpc.make("ListWidgets", {
    payload: { projectId: Schema.String },
    success: Schema.Array(Schema.Struct({ id: Schema.String })),
  }),
).middleware(AuthMiddleware);

const TestHandlers = TestRpcs.toLayer({
  ListWidgets: ({ projectId }) =>
    AuthSession.use((session) =>
      Effect.succeed([{ id: `${session.projects[0]?.id ?? "none"}:${projectId}` }]),
    ),
});

const TestApiKeys = Layer.succeed(ApiKeyService, {
  validateUserApiKey: (token: string) =>
    token === "valid-user-key"
      ? Effect.succeed({ user: { id: "user-from-key" } } as never)
      : Effect.fail(new ApiKeyNotFoundError({})),
  validateSecretKey: (token: string) =>
    token === "valid-project-key"
      ? Effect.succeed({
          project: {
            id: "project-from-key",
            name: "MCP test",
            organizationId: "org-test",
            slug: "mcp-test",
          },
        } as never)
      : Effect.fail(new ApiKeyNotFoundError({})),
} as unknown as ApiKeyService["Service"]);

const TestLocalSessions = Layer.succeed(LocalUserSessionService, {
  loadUserAccess: () => Effect.succeed({} as never),
  toUserSession: () => ({
    cookie: null,
    method: "user",
    name: "MCP user",
    organizations: [],
    person: null,
    projects: [
      {
        id: "project-from-user",
        logo: null,
        name: "MCP user project",
        organizationId: "org-test",
        permissions: ["project:all"],
        slug: "mcp-user-project",
      },
    ],
    user: {
      createdAt: new Date(0),
      email: "mcp@example.test",
      emailVerified: true,
      id: "user-from-key",
      image: null,
      name: "MCP user",
      role: null,
      updatedAt: new Date(0),
      workosUserId: null,
    },
  }),
} as unknown as LocalUserSessionService["Service"]);

interface McpRequest {
  readonly body: unknown;
  readonly token?: string;
}

const requestFrom = ({ body, token }: McpRequest) => {
  const headers = new Headers({ "content-type": "application/json" });
  if (token !== undefined) {
    headers.set("authorization", `Bearer ${token}`);
  }
  return HttpServerRequest.fromWeb(
    new Request("http://localhost/api/mcp", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
  );
};

const serve = (requests: ReadonlyArray<McpRequest>) =>
  Effect.gen(function* () {
    const handler = yield* HttpRouter.toHttpEffect(
      McpRouteLayer(TestRpcs).pipe(
        Layer.provide(TestHandlers),
        Layer.provide(TestApiKeys),
        Layer.provide(TestLocalSessions),
      ),
    );
    const responses: Response[] = [];
    for (const request of requests) {
      const response = yield* handler.pipe(
        Effect.provideService(HttpServerRequest.HttpServerRequest, requestFrom(request)),
      );
      responses.push(HttpServerResponse.toWeb(response));
    }
    return responses;
  }).pipe(Effect.provideService(Db, {} as Db["Service"]), Effect.scoped, Effect.runPromise);

describe("POST /api/mcp", () => {
  it("rejects missing and invalid bearer credentials", async () => {
    const [missing, invalid] = await serve([
      { body: { jsonrpc: "2.0", id: 1, method: "ping" } },
      { body: { jsonrpc: "2.0", id: 1, method: "ping" }, token: "invalid" },
    ]);
    expect(missing.status).toBe(401);
    expect(missing.headers.get("www-authenticate")).toContain("Bearer");
    expect(invalid.status).toBe(401);
  });

  it("initializes and calls a platform operation without isolate-local session state", async () => {
    const [initialized, called] = await serve([
      {
        token: "valid-project-key",
        body: {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-06-18",
            capabilities: {},
            clientInfo: { name: "test", version: "1" },
          },
        },
      },
      {
        token: "valid-project-key",
        body: {
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
      },
    ]);
    expect(initialized.status).toBe(200);
    expect(initialized.headers.get("mcp-session-id")).toBeNull();
    expect(await initialized.json()).toMatchObject({
      result: { capabilities: { tools: {}, resources: {} } },
    });

    expect(called.status).toBe(200);
    expect(await called.json()).toMatchObject({
      result: {
        isError: false,
        structuredContent: [{ id: "project-from-key:project-from-input" }],
      },
    });
  });

  it("accepts user API keys and materializes their normal project access", async () => {
    const [called] = await serve([
      {
        token: "valid-user-key",
        body: {
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: {
            name: "platform_call",
            arguments: {
              operation: "list_widgets",
              input: { projectId: "project-from-input" },
            },
          },
        },
      },
    ]);
    expect(await called.json()).toMatchObject({
      result: {
        isError: false,
        structuredContent: [{ id: "project-from-user:project-from-input" }],
      },
    });
  });
});
