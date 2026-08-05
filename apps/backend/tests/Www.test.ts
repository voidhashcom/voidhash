import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { isWwwRequest, makeWwwRequestHandler } from "../src/www/Www.ts";

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

const startTestServer = async (clientDirectory: string) => {
  const handler = makeWwwRequestHandler({
    clientDirectory,
    fetch: (request) => new Response(`SSR ${new URL(request.url).pathname}`, {
      headers: { "content-type": "text/plain" },
    }),
  });
  const server = createServer((request, response) => {
    handler(request, response).catch((error) => {
      response.statusCode = 500;
      response.end(String(error));
    });
  });
  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  cleanups.push(() => new Promise<void>((resolveClose) => server.close(() => resolveClose())));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Test server did not expose a TCP address");
  }
  return `http://127.0.0.1:${address.port}`;
};

describe("WWW Node handler", () => {
  it("serves built assets and falls back to SSR", async () => {
    const root = await mkdtemp(join(tmpdir(), "voidhash-www-"));
    cleanups.push(() => rm(root, { force: true, recursive: true }));
    await mkdir(join(root, "assets"));
    await writeFile(join(root, "assets", "app.js"), "export const ready = true;");
    const origin = await startTestServer(root);

    const asset = await fetch(`${origin}/assets/app.js`);
    expect(asset.status).toBe(200);
    expect(asset.headers.get("cache-control")).toContain("immutable");
    expect(asset.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
    expect(await asset.text()).toBe("export const ready = true;");

    const page = await fetch(`${origin}/studio`);
    expect(page.status).toBe(200);
    expect(await page.text()).toBe("SSR /studio");
  });
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
