import {
  PublicFileStore,
  PublicFileStoreError,
  type PublicFileStoreShape,
} from "@voidhash/core/services";
import { Effect, Layer } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { describe, expect, it } from "vite-plus/test";

import { PublicFileServingRouteLayer } from "./public-file-serving.ts";

const BASE_URL = "https://files.test.invalid";

/** In-memory store with one entry per declared object key. */
const storeLayer = (objects: Record<string, { body: string; contentType: string | null }>) => {
  const shape: PublicFileStoreShape = {
    publicBaseUrl: BASE_URL,
    publicUrl: (key) => `${BASE_URL}/files/${key}`,
    getObject: (key) =>
      Effect.sync(() => {
        const object = objects[key];
        if (object === undefined) return null;
        return { body: new TextEncoder().encode(object.body), contentType: object.contentType };
      }),
    putObject: () => Effect.void,
    deleteObject: () => Effect.void,
  };
  return Layer.succeed(PublicFileStore, shape);
};

const failingStoreLayer = Layer.succeed(PublicFileStore, {
  publicBaseUrl: BASE_URL,
  publicUrl: (key: string) => `${BASE_URL}/files/${key}`,
  getObject: () => Effect.fail(new PublicFileStoreError({ cause: "boom", message: "store down" })),
  putObject: () => Effect.void,
  deleteObject: () => Effect.void,
});

const serve = (path: string, store: Layer.Layer<PublicFileStore>) =>
  Effect.gen(function* () {
    const handler = yield* HttpRouter.toHttpEffect(
      PublicFileServingRouteLayer.pipe(HttpRouter.provideRequest(store)),
    );
    const response = yield* handler.pipe(
      Effect.provideService(
        HttpServerRequest.HttpServerRequest,
        HttpServerRequest.fromWeb(new Request(`http://localhost${path}`)),
      ),
    );
    return HttpServerResponse.toWeb(response);
  }).pipe(Effect.scoped, Effect.runPromise);

describe("GET /files/*", () => {
  it("serves a stored object with its Content-Type, immutable caching, CORS, and nosniff", () => {
    const store = storeLayer({
      "avatars/organization/org_1/abc.webp": { body: "webp-bytes", contentType: "image/webp" },
    });

    return serve("/files/avatars/organization/org_1/abc.webp", store).then((response) => {
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("image/webp");
      expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
      expect(response.headers.get("access-control-allow-origin")).toBe("*");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      return response.text().then((text) => {
        expect(text).toBe("webp-bytes");
      });
    });
  });

  it("does NOT stamp a CSP sandbox (images load cross-origin as <img>, unlike paywall HTML)", () => {
    const store = storeLayer({ "avatars/x.webp": { body: "x", contentType: "image/webp" } });

    return serve("/files/avatars/x.webp", store).then((response) => {
      expect(response.status).toBe(200);
      expect(response.headers.get("content-security-policy")).toBeNull();
    });
  });

  it("falls back to application/octet-stream when no Content-Type is stored", () => {
    const store = storeLayer({ "avatars/x": { body: "x", contentType: null } });

    return serve("/files/avatars/x", store).then((response) => {
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("application/octet-stream");
    });
  });

  it("returns 404 JSON for a missing object, with readable CORS", () =>
    serve("/files/avatars/missing.webp", storeLayer({})).then((response) => {
      expect(response.status).toBe(404);
      expect(response.headers.get("access-control-allow-origin")).toBe("*");
      return response.json().then((payload) => {
        expect(payload).toEqual({ error: "Not found" });
      });
    }));

  it("returns 502 when the store fails, with readable CORS", () =>
    serve("/files/avatars/x.webp", failingStoreLayer).then((response) => {
      expect(response.status).toBe(502);
      expect(response.headers.get("access-control-allow-origin")).toBe("*");
      return response.json().then((payload) => {
        expect(payload).toEqual({ error: "Failed to load file" });
      });
    }));
});
