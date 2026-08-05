import { Effect, Layer } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";

import { McpOAuth } from "../McpOAuth.ts";

const METADATA_HEADERS = { "cache-control": "public, max-age=300" } as const;

const requestOrigin = (request: HttpServerRequest.HttpServerRequest): string => {
  try {
    return new URL(request.originalUrl).origin;
  } catch {
    const host = request.headers.host ?? "localhost";
    const protocol = request.headers["x-forwarded-proto"] ?? "http";
    return `${protocol}://${host}`;
  }
};

const unavailable = HttpServerResponse.json(
  { error: "MCP OAuth is not configured" },
  { status: 503 },
);

const protectedResourceMetadata = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const mcpOAuth = yield* McpOAuth;
  if (!mcpOAuth.authorizationServer) return yield* unavailable;
  return yield* HttpServerResponse.json(
    {
      authorization_servers: [mcpOAuth.authorizationServer],
      bearer_methods_supported: ["header"],
      resource: `${requestOrigin(request)}/api/mcp`,
    },
    { headers: METADATA_HEADERS },
  );
});

const authorizationServerMetadata = Effect.gen(function* () {
  const mcpOAuth = yield* McpOAuth;
  const result = yield* Effect.result(mcpOAuth.fetchAuthorizationServerMetadata());
  return result._tag === "Success"
    ? yield* HttpServerResponse.json(result.success, { headers: METADATA_HEADERS })
    : yield* HttpServerResponse.json({ error: result.failure.message }, { status: 502 });
});

const registerMcpOAuthRoutes = Effect.gen(function* () {
  const router = yield* HttpRouter.HttpRouter;
  yield* router.add("GET", "/.well-known/oauth-protected-resource", protectedResourceMetadata);
  yield* router.add(
    "GET",
    "/.well-known/oauth-protected-resource/api/mcp",
    protectedResourceMetadata,
  );
  yield* router.add("GET", "/.well-known/oauth-authorization-server", authorizationServerMetadata);
});

/** AuthKit-backed OAuth discovery endpoints for the MCP protected resource. */
export const McpOAuthRouteLayer = Layer.effectDiscard(registerMcpOAuthRoutes);
