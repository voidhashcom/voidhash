/**
 * Authenticated, stateless streamable-HTTP MCP endpoint for Cloudflare Workers.
 *
 * Effect MCP owns the tool/resource registry, schemas, and result model. The
 * HTTP adapter is intentionally stateless because isolate-local MCP session
 * maps cannot provide affinity across Cloudflare Worker requests.
 */
import { AuthSession } from "@voidhash/core/domain/auth/Auth";
import { ApiKeyService, LocalUserSessionService } from "@voidhash/core/services";
import type { SecretKeySession } from "@voidhash/rpc";
import { Cause, Context, Effect, Layer, Result } from "effect";
import { McpSchema, McpServer } from "effect/unstable/ai";
import * as HttpHeaders from "effect/unstable/http/Headers";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import type { Rpc } from "effect/unstable/rpc";
import type { RpcGroup } from "effect/unstable/rpc/RpcGroup";

import * as WorkspaceTools from "../ai/workspace-tools.ts";
import {
  handleStatelessMcpMessage,
  JsonRpcErrorCode,
  parseJsonRpcMessage,
  SUPPORTED_PROTOCOL_VERSIONS,
} from "../mcp/cloudflare-http.ts";
import {
  makePlatformOperations,
  type PlatformOperation,
  platformOperationDescriptors,
  registerPlatformTools,
} from "../mcp/platform-tools.ts";
import { MCP_TOOLS } from "../mcp/tool-manifest.ts";

const WWW_AUTHENTICATE = 'Bearer realm="voidhash-mcp"';
const SERVER_INFO = { name: "voidhash", version: "1.0.0" } as const;

const jsonRpcErrorResponse = (status: number, code: number, message: string) =>
  HttpServerResponse.json({ jsonrpc: "2.0", id: null, error: { code, message } }, { status });

const bearerToken = (headers: HttpHeaders.Headers): string | undefined => {
  const raw = HttpHeaders.get(headers, "authorization");
  const value = raw._tag === "Some" ? raw.value : undefined;
  const match = value === undefined ? null : /^Bearer\s+(.+)$/i.exec(value.trim());
  return match?.[1]?.trim();
};

const secretKeySessionForProject = (project: {
  readonly id: string;
  readonly name: string;
  readonly organizationId: string;
  readonly slug: string;
}): SecretKeySession => ({
  cookie: null,
  method: "secret-key",
  name: `${project.name} API Key`,
  organizations: [],
  person: null,
  projects: [
    {
      id: project.id,
      logo: null,
      name: project.name,
      organizationId: project.organizationId,
      permissions: ["project:all"],
      slug: project.slug,
    },
  ],
  user: null,
});

const authenticateBearer = (
  token: string,
  apiKeys: ApiKeyService["Service"],
  localSessions: LocalUserSessionService["Service"],
) =>
  Effect.gen(function* () {
    const userKey = yield* Effect.result(apiKeys.validateUserApiKey(token));
    if (Result.isSuccess(userKey)) {
      const access = yield* localSessions.loadUserAccess(userKey.success.user.id);
      return localSessions.toUserSession(userKey.success.user, access, null, null);
    }

    const projectKey = yield* Effect.result(apiKeys.validateSecretKey(token));
    if (Result.isFailure(projectKey)) {
      return undefined;
    }
    return secretKeySessionForProject(projectKey.success.project);
  });

const workspaceToolResult = (result: WorkspaceTools.WorkspaceToolResult) =>
  new McpSchema.CallToolResult({
    content: [{ type: "text", text: result.output }],
    structuredContent: { output: result.output },
    isError: result.isError,
  });

const registerWorkspaceTools = (server: McpServer.McpServer["Service"]): Effect.Effect<void> =>
  Effect.forEach(
    MCP_TOOLS,
    (tool) =>
      server.addTool({
        tool: new McpSchema.Tool({
          ...tool.descriptor,
          annotations: {
            readOnlyHint: [
              "list_paywalls",
              "get_paywall",
              "get_components",
              "read_component",
            ].includes(tool.descriptor.name),
            destructiveHint: tool.descriptor.name === "delete_component",
            idempotentHint: tool.descriptor.name !== "edit_paywall",
            openWorldHint: false,
          },
        }),
        annotations: Context.empty(),
        // The low-level Effect MCP registry types handlers as McpServerClient-
        // only. AuthSession and workspace services are supplied by this route's
        // authenticated request context.
        handle: ((args: unknown) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const projectId = session.projects[0]?.id;
            if (projectId === undefined) {
              return workspaceToolResult({
                output: "This tool requires access to a project.",
                isError: true,
              });
            }
            return workspaceToolResult(yield* tool.dispatch({ projectId }, args));
          })) as never,
      }),
    { discard: true },
  );

const registerResources = (
  server: McpServer.McpServer["Service"],
  operations: ReadonlyArray<PlatformOperation>,
): Effect.Effect<void> =>
  Effect.gen(function* () {
    const catalogUri = "voidhash://platform/operations";
    yield* server.addResource({
      resource: new McpSchema.Resource({
        uri: catalogUri,
        name: "Platform operations",
        description:
          "Every typed platform operation accepted by platform_call, including its exact input JSON Schema.",
        mimeType: "application/json",
      }),
      annotations: Context.empty(),
      handle: Effect.succeed({
        contents: [
          {
            uri: catalogUri,
            mimeType: "application/json",
            text: JSON.stringify({ operations: platformOperationDescriptors(operations) }, null, 2),
          },
        ],
      }),
    });

    yield* server.addResourceTemplate({
      template: new McpSchema.ResourceTemplate({
        uriTemplate: "voidhash://paywalls/{slug}",
        name: "Live paywall document",
        description: "A live paywall document tree addressed by its project-local slug.",
        mimeType: "application/json",
      }),
      routerPath: "voidhash:://paywalls/:0",
      completions: {},
      annotations: Context.empty(),
      // Like tool calls, template reads resolve auth/workspace services from the
      // current request rather than capturing one user's session at startup.
      handle: ((uri: string, params: Array<string>) =>
        Effect.gen(function* () {
          const session = yield* AuthSession;
          const projectId = session.projects[0]?.id;
          if (projectId === undefined) {
            return yield* Effect.die(new Error("This resource requires access to a project"));
          }
          const result = yield* WorkspaceTools.getPaywall({ projectId }, { slug: params[0] });
          if (result.isError) {
            return yield* Effect.die(new Error(result.output));
          }
          return { contents: [{ uri, mimeType: "application/json", text: result.output }] };
        })) as never,
    });
  });

/** Creates the Effect MCP route layer for all RPCs in the composed platform. */
export const McpRouteLayer = <Rpcs extends Rpc.Any>(group: RpcGroup<Rpcs>) =>
  Layer.effectDiscard(
    Effect.gen(function* () {
      const router = yield* HttpRouter.HttpRouter;
      const server = yield* McpServer.McpServer;
      const apiKeys = yield* ApiKeyService;
      const localSessions = yield* LocalUserSessionService;
      const operations = yield* makePlatformOperations(group);

      yield* registerWorkspaceTools(server);
      yield* registerPlatformTools(server, operations);
      yield* registerResources(server, operations);

      const handlePost = Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const token = bearerToken(request.headers);
        if (token === undefined) {
          return HttpServerResponse.setHeader(
            yield* jsonRpcErrorResponse(
              401,
              JsonRpcErrorCode.InvalidRequest,
              "Missing bearer token",
            ),
            "www-authenticate",
            WWW_AUTHENTICATE,
          );
        }

        const authenticated = yield* Effect.result(
          authenticateBearer(token, apiKeys, localSessions),
        );
        if (Result.isFailure(authenticated) || authenticated.success === undefined) {
          return HttpServerResponse.setHeader(
            yield* jsonRpcErrorResponse(
              401,
              JsonRpcErrorCode.InvalidRequest,
              "Invalid or expired API key",
            ),
            "www-authenticate",
            WWW_AUTHENTICATE,
          );
        }

        const rawBody = yield* request.text;
        const parsedJson = yield* Effect.result(
          Effect.try({
            try: () => JSON.parse(rawBody) as unknown,
            catch: () => new Error("Invalid JSON"),
          }),
        );
        if (Result.isFailure(parsedJson)) {
          return yield* jsonRpcErrorResponse(
            400,
            JsonRpcErrorCode.ParseError,
            "Parse error: request body is not valid JSON",
          );
        }

        const parsed = parseJsonRpcMessage(parsedJson.success);
        if (!parsed.ok) {
          return yield* jsonRpcErrorResponse(400, JsonRpcErrorCode.InvalidRequest, parsed.reason);
        }

        const response = yield* handleStatelessMcpMessage(server, parsed.message, SERVER_INFO).pipe(
          Effect.provideService(AuthSession, authenticated.success),
        );
        if (response === null) {
          return HttpServerResponse.empty({ status: 202 });
        }

        const protocolVersion =
          typeof parsed.message.params?.protocolVersion === "string" &&
          (SUPPORTED_PROTOCOL_VERSIONS as ReadonlyArray<string>).includes(
            parsed.message.params.protocolVersion,
          )
            ? parsed.message.params.protocolVersion
            : SUPPORTED_PROTOCOL_VERSIONS[0];
        return HttpServerResponse.setHeader(
          yield* HttpServerResponse.json(response),
          "mcp-protocol-version",
          protocolVersion,
        );
      });

      const methodNotAllowed = HttpServerResponse.json(
        {
          jsonrpc: "2.0",
          id: null,
          error: { code: JsonRpcErrorCode.InvalidRequest, message: "Method Not Allowed" },
        },
        { status: 405, headers: { allow: "POST" } },
      );

      yield* router.add(
        "POST",
        "/api/mcp",
        handlePost.pipe(
          Effect.catchCause((cause) =>
            Effect.gen(function* () {
              yield* Effect.logError(`MCP request error: ${Cause.pretty(cause)}`);
              return yield* jsonRpcErrorResponse(
                500,
                JsonRpcErrorCode.InternalError,
                "Internal error",
              );
            }),
          ),
        ),
      );
      yield* router.add("GET", "/api/mcp", methodNotAllowed);
      yield* router.add("DELETE", "/api/mcp", methodNotAllowed);
    }),
  ).pipe(Layer.provide(McpServer.McpServer.layer));
