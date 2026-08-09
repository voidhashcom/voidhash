// oxlint-disable-next-line effect/noNodeBuiltinImport -- the test stands up a real `node:http` server to receive live requests; an `HttpServer` layer would not exercise the same wire path.
import { createServer } from "node:http";

import { NodeFileSystem, NodePath } from "@effect/platform-node";
import { Data, Effect, FileSystem, Layer, Path } from "effect";
import { FetchHttpClient, HttpClient } from "effect/unstable/http";
import { describe, expect, it } from "vitest";

import { isWwwRequest, makeWwwRequestHandler } from "../src/www/Www.ts";

class TestServerAddressError extends Data.TaggedError("TestServerAddressError")<{
  readonly message: string;
}> {}

const testServices = Layer.mergeAll(
  NodeFileSystem.layer,
  NodePath.layer,
  FetchHttpClient.layer,
);

/** Starts the WWW handler on an ephemeral port; the server closes with the scope. */
const startTestServer = (clientDirectory: string) =>
  Effect.gen(function* () {
    const handler = makeWwwRequestHandler({
      clientDirectory,
      fetch: (request) =>
        new Response(`SSR ${new URL(request.url).pathname}`, {
          headers: { "content-type": "text/plain" },
        }),
    });
    const server = createServer((request, response) => {
      handler(request, response).catch((error: unknown) => {
        response.statusCode = 500;
        response.end(String(error));
      });
    });
    yield* Effect.acquireRelease(
      Effect.callback<void>((resume) => {
        server.listen(0, "127.0.0.1", () => resume(Effect.void));
      }),
      () =>
        Effect.callback<void>((resume) => {
          server.close(() => resume(Effect.void));
        }),
    );
    const address = server.address();
    if (address === null || typeof address === "string") {
      return yield* new TestServerAddressError({
        message: "Test server did not expose a TCP address",
      });
    }
    return `http://127.0.0.1:${address.port}`;
  });

describe("WWW Node handler", () => {
  it("serves built assets and falls back to SSR", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fileSystem.makeTempDirectoryScoped({ prefix: "voidhash-www-" });
        yield* fileSystem.makeDirectory(path.join(root, "assets"));
        yield* fileSystem.writeFileString(
          path.join(root, "assets", "app.js"),
          "export const ready = true;",
        );
        const origin = yield* startTestServer(root);
        const client = yield* HttpClient.HttpClient;

        const asset = yield* client.get(`${origin}/assets/app.js`);
        expect(asset.status).toBe(200);
        expect(asset.headers["cache-control"]).toContain("immutable");
        expect(asset.headers["content-type"]).toBe("text/javascript; charset=utf-8");
        const assetBody = yield* asset.text;
        expect(assetBody).toBe("export const ready = true;");

        const page = yield* client.get(`${origin}/studio`);
        expect(page.status).toBe(200);
        const pageBody = yield* page.text;
        expect(pageBody).toBe("SSR /studio");
      }).pipe(Effect.scoped, Effect.provide(testServices)),
    ));
});

describe("WWW route ownership", () => {
  it.each(["/", "/studio", "/docs", "/_serverFn/abc", "/api/auth/callback"])(
    "routes %s to WWW",
    (pathname) => expect(isWwwRequest(pathname)).toBe(true),
  );

  it.each([
    "/health",
    "/rpc",
    "/rpc/users",
    "/i/v1/capture",
    "/api/v1/users",
    "/files/avatar.png",
    "/p/hash/index.html",
    "/c/hash/runtime.js",
  ])(
    "routes %s to the backend",
    (pathname) => expect(isWwwRequest(pathname)).toBe(false),
  );
});
