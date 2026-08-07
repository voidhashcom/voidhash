import {
  PaywallArtifactStore,
  PaywallArtifactStoreError,
  type PaywallArtifactStoreShape,
} from "@voidhash/core/services";
import { constant } from "@voidhash/lib/lang";
import { Effect, Layer } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { describe, expect, it } from "vite-plus/test";

import { PaywallServingRouteLayer } from "./paywall-serving.ts";

const CONTENT_HASH = "a".repeat(64);

/** In-memory store with one serving layout entry per declared object. */
const storeLayer = (objects: Record<string, { body: string; contentType: string | null }>) => {
  const shape: PaywallArtifactStoreShape = {
    bucketName: "test-bucket",
    getObject: (key) =>
      Effect.sync(() => {
        const object = objects[key];
        if (object === undefined) return null;
        return { body: new TextEncoder().encode(object.body), contentType: object.contentType };
      }),
    head: () => Effect.succeed(null),
    putObject: () => Effect.void,
  };
  return Layer.succeed(PaywallArtifactStore, shape);
};

const failingStoreLayer = Layer.succeed(PaywallArtifactStore, {
  bucketName: "test-bucket",
  getObject: () =>
    Effect.fail(new PaywallArtifactStoreError({ cause: "boom", message: "store down" })),
  head: () => Effect.succeed(null),
  putObject: () => Effect.void,
});

const serve = (path: string, store: Layer.Layer<PaywallArtifactStore>) =>
  Effect.gen(function* () {
    const handler = yield* HttpRouter.toHttpEffect(
      PaywallServingRouteLayer.pipe(HttpRouter.provideRequest(store)),
    );
    const response = yield* handler.pipe(
      Effect.provideService(
        HttpServerRequest.HttpServerRequest,
        HttpServerRequest.fromWeb(new Request(`http://localhost${path}`)),
      ),
    );
    return HttpServerResponse.toWeb(response);
  }).pipe(Effect.scoped);

/** §5 security headers expected on EVERY /p/* response. */
const expectSecurityHeaders = (response: Response) => {
  expect(response.headers.get("content-security-policy")).toBe("sandbox allow-scripts allow-forms");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
};

describe("GET /p/:contentHash/* (deploy contract §5)", () => {
  it("serves a stored artifact with stored Content-Type, immutable caching, and permissive CORS", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const store = storeLayer({
          [`p/${CONTENT_HASH}/index.html`]: {
            body: "<html></html>",
            contentType: "text/html; charset=utf-8",
          },
        });

        const response = yield* serve(`/p/${CONTENT_HASH}/index.html`, store);

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
        expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
        expect(response.headers.get("access-control-allow-origin")).toBe("*");
        const text = yield* Effect.promise(() => response.text());
        expect(text).toBe("<html></html>");
      }),
    ));

  it("stamps the CSP sandbox, nosniff, and no-referrer security headers on served artifacts", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const store = storeLayer({
          [`p/${CONTENT_HASH}/index.html`]: {
            body: "<html></html>",
            contentType: "text/html; charset=utf-8",
          },
        });

        const response = yield* serve(`/p/${CONTENT_HASH}/index.html`, store);

        expect(response.status).toBe(200);
        expectSecurityHeaders(response);
        // The hardening headers must not displace the §5 CORS + caching headers.
        expect(response.headers.get("access-control-allow-origin")).toBe("*");
        expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
      }),
    ));

  it("serves nested asset paths under the contentHash prefix", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const store = storeLayer({
          [`p/${CONTENT_HASH}/assets/hero-AB12CD.png`]: {
            body: "png-bytes",
            contentType: "image/png",
          },
        });

        const response = yield* serve(`/p/${CONTENT_HASH}/assets/hero-AB12CD.png`, store);

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe("image/png");
      }),
    ));

  it("falls back to application/octet-stream when no Content-Type is stored", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const store = storeLayer({
          [`p/${CONTENT_HASH}/bundle.js`]: { body: "js", contentType: null },
        });

        const response = yield* serve(`/p/${CONTENT_HASH}/bundle.js`, store);

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe("application/octet-stream");
      }),
    ));

  it("returns 404 JSON for a missing object, with security headers and readable CORS", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const response = yield* serve(`/p/${CONTENT_HASH}/missing.js`, storeLayer({}));

        expect(response.status).toBe(404);
        expectSecurityHeaders(response);
        expect(response.headers.get("access-control-allow-origin")).toBe("*");
        const payload = yield* Effect.promise(() => response.json());
        expect(payload).toEqual({ error: "Not found" });
      }),
    ));

  it("returns 404 for a non-hex contentHash without touching the store", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const response = yield* serve("/p/not-a-hash/index.html", failingStoreLayer);

        expect(response.status).toBe(404);
      }),
    ));

  it("returns 404 for dot-dot path segments without touching the store", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const response = yield* serve(`/p/${CONTENT_HASH}/../escape.html`, failingStoreLayer);

        expect(response.status).toBe(404);
      }),
    ));

  it("returns 502 when the artifact store fails, with security headers and readable CORS", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const response = yield* serve(`/p/${CONTENT_HASH}/index.html`, failingStoreLayer);

        expect(response.status).toBe(502);
        expectSecurityHeaders(response);
        expect(response.headers.get("access-control-allow-origin")).toBe("*");
        const payload = yield* Effect.promise(() => response.json());
        expect(payload).toEqual({ error: "Failed to load paywall artifact" });
      }),
    ));
});

describe("GET /c/:contentHash/* (deploy contract §5.1)", () => {
  const componentStore = () =>
    storeLayer({
      [`c/${CONTENT_HASH}/manifest.json`]: {
        body: '{"manifestVersion":1}',
        contentType: "application/json",
      },
      [`c/${CONTENT_HASH}/previews/default.json`]: {
        body: '{"treeVersion":1}',
        contentType: "application/json",
      },
      [`c/${CONTENT_HASH}/runtime.js`]: {
        body: "export {};",
        contentType: "text/javascript; charset=utf-8",
      },
    });

  it("serves component artifacts with the same §5 success headers", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        for (const [path, contentType] of constant([
          [`/c/${CONTENT_HASH}/manifest.json`, "application/json"],
          [`/c/${CONTENT_HASH}/previews/default.json`, "application/json"],
          [`/c/${CONTENT_HASH}/runtime.js`, "text/javascript; charset=utf-8"],
        ])) {
          const response = yield* serve(path, componentStore());

          expect(response.status, path).toBe(200);
          expect(response.headers.get("content-type")).toBe(contentType);
          expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
          expect(response.headers.get("access-control-allow-origin")).toBe("*");
          expectSecurityHeaders(response);
        }
      }),
    ));

  it("does not serve /p/ objects from the /c/ prefix", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const store = storeLayer({
          [`p/${CONTENT_HASH}/index.html`]: {
            body: "<html></html>",
            contentType: "text/html; charset=utf-8",
          },
        });

        const response = yield* serve(`/c/${CONTENT_HASH}/index.html`, store);

        expect(response.status).toBe(404);
      }),
    ));

  it("returns a CORS-readable 404 for a missing preview state", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const response = yield* serve(`/c/${CONTENT_HASH}/previews/trial.json`, componentStore());

        expect(response.status).toBe(404);
        expect(response.headers.get("access-control-allow-origin")).toBe("*");
        expectSecurityHeaders(response);
        const payload = yield* Effect.promise(() => response.json());
        expect(payload).toEqual({ error: "Not found" });
      }),
    ));

  it("returns 404 for a non-hex contentHash without touching the store", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const response = yield* serve("/c/not-a-hash/manifest.json", failingStoreLayer);

        expect(response.status).toBe(404);
      }),
    ));

  it("returns a CORS-readable 502 when the artifact store fails", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const response = yield* serve(`/c/${CONTENT_HASH}/manifest.json`, failingStoreLayer);

        expect(response.status).toBe(502);
        expect(response.headers.get("access-control-allow-origin")).toBe("*");
        expectSecurityHeaders(response);
      }),
    ));
});
