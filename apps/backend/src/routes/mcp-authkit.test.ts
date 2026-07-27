import { Effect, Layer } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { describe, expect, it } from "vite-plus/test";

import { makeMcpAuthKit, McpAuthKit } from "../McpAuthKit.ts";
import { McpAuthKitRouteLayer } from "./mcp-authkit.ts";

const serve = (path: string, authorizationServer?: string) =>
  Effect.gen(function* () {
    const authKit = Layer.succeed(
      McpAuthKit,
      McpAuthKit.of(makeMcpAuthKit(authorizationServer, undefined)),
    );
    const handler = yield* HttpRouter.toHttpEffect(
      McpAuthKitRouteLayer.pipe(HttpRouter.provideRequest(authKit)),
    );
    const response = yield* handler.pipe(
      Effect.provideService(
        HttpServerRequest.HttpServerRequest,
        HttpServerRequest.fromWeb(new Request(`https://api.example.com${path}`)),
      ),
    );
    return HttpServerResponse.toWeb(response);
  }).pipe(Effect.scoped, Effect.runPromise);

describe("MCP AuthKit metadata", () => {
  it("points the protected resource at the configured AuthKit issuer", async () => {
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

  it("fails closed when no AuthKit issuer is configured", async () => {
    const response = await serve("/.well-known/oauth-protected-resource");

    expect(response.status).toBe(503);
  });
});
