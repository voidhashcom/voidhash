import { constant, stringOr } from "@voidhash/lib/lang";
import { Effect, Layer } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";

import { McpOAuth } from "../McpOAuth.ts";

const METADATA_HEADERS = constant({ "cache-control": "public, max-age=300" });

const requestOrigin = (
  request: HttpServerRequest.HttpServerRequest,
): Effect.Effect<string> =>
  Effect.try(() => new URL(request.originalUrl).origin).pipe(
    Effect.orElseSucceed(() => {
      const host = stringOr(request.headers.host, "localhost");
      const protocol = stringOr(request.headers["x-forwarded-proto"], "http");
      return `${protocol}://${host}`;
    }),
  );

const unavailable = HttpServerResponse.json(
  { error: "MCP OAuth is not configured" },
  { status: 503 },
);

const protectedResourceMetadata = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const mcpOAuth = yield* McpOAuth;
  if (!mcpOAuth.authorizationServer) return yield* unavailable;
  const origin = yield* requestOrigin(request);
  return yield* HttpServerResponse.json(
    {
      authorization_servers: [mcpOAuth.authorizationServer],
      bearer_methods_supported: ["header"],
      resource: `${origin}/api/mcp`,
    },
    { headers: METADATA_HEADERS },
  );
});

const authorizationServerMetadata = Effect.gen(function* () {
  const mcpOAuth = yield* McpOAuth;
  const result = yield* Effect.result(mcpOAuth.fetchAuthorizationServerMetadata());
  if (result._tag === "Success") {
    return yield* HttpServerResponse.json(result.success, { headers: METADATA_HEADERS });
  }
  return yield* HttpServerResponse.json({ error: result.failure.message }, { status: 502 });
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
