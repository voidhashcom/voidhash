import { Effect, Layer } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { describe, expect, it } from "vite-plus/test";

import { McpOAuth, McpOAuthError, McpOAuthUnconfiguredLive } from "../McpOAuth.ts";
import { McpOAuthRouteLayer } from "./mcp-oauth.ts";

/** Stand-in for a deployment that does run an authorization server. */
const configuredLive = (authorizationServer: string) =>
  Layer.succeed(McpOAuth)(
    McpOAuth.of({
      authorizationServer,
      fetchAuthorizationServerMetadata: () => Effect.succeed({ issuer: authorizationServer }),
      verifyAccessToken: () =>
        Effect.fail(new McpOAuthError({ kind: "invalid_token", message: "not exercised" })),
    }),
  );

const serve = (path: string, authorizationServer?: string) =>
  Effect.gen(function* () {
    const oauth = authorizationServer
      ? configuredLive(authorizationServer)
      : McpOAuthUnconfiguredLive;
    const handler = yield* HttpRouter.toHttpEffect(
      McpOAuthRouteLayer.pipe(HttpRouter.provideRequest(oauth)),
    );
    const response = yield* handler.pipe(
      Effect.provideService(
        HttpServerRequest.HttpServerRequest,
        HttpServerRequest.fromWeb(new Request(`https://api.example.com${path}`)),
      ),
    );
    return HttpServerResponse.toWeb(response);
  }).pipe(Effect.scoped, Effect.runPromise);

describe("MCP OAuth metadata", () => {
  it("points the protected resource at the configured issuer", async () => {
    const response = await serve(
      "/.well-known/oauth-protected-resource/api/mcp",
      "https://example.authkit.app",
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      authorization_servers: ["https://example.authkit.app"],
      bearer_methods_supported: ["header"],
      resource: "https://api.example.com/api/mcp",
    });
  });

  it("fails closed when the deployment runs no authorization server", async () => {
    const response = await serve("/.well-known/oauth-protected-resource");

    expect(response.status).toBe(503);
  });
});
