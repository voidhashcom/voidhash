/**
 * Public asset serving — `GET /files/*`.
 *
 * Stored public files are unauthenticated images served cross-origin as
 * `<img src>`. Most use immutable content-addressed keys; mutable paywall
 * thumbnails append their document sequence to the public URL as a cache
 * buster. Unlike the paywall HTML routes, there is NO CSP sandbox; just the
 * stored `Content-Type`, an immutable cache policy, permissive CORS, and
 * `nosniff`.
 */
import { PublicFileStore } from "@voidhash/core/services";
import { constant } from "@voidhash/lib/lang";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { HttpRouter, HttpServerResponse } from "effect/unstable/http";
import * as Str from "effect/String";

const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

const HEADERS = constant({
  "access-control-allow-origin": "*",
  "x-content-type-options": "nosniff",
});

const notFound = HttpServerResponse.json({ error: "Not found" }, { headers: HEADERS, status: 404 });

const handleServe = Effect.fn("handleServe")(function* () {
  const store = yield* PublicFileStore;
  const params = yield* HttpRouter.params;
  const key = params["*"];

  // `..` has no traversal semantics in object storage, but reject it anyway so
  // the route never echoes a creative key back into the store.
  if (
    key === undefined ||
    Str.isEmpty(key) ||
    key.split("/").some((segment) => Str.isEmpty(segment) || segment === "..")
  ) {
    return yield* notFound;
  }

  const object = yield* store.getObject(key);
  if (Option.isNone(object)) {
    return yield* notFound;
  }

  return HttpServerResponse.uint8Array(object.value.body, {
    contentType: Option.getOrElse(object.value.contentType, () => "application/octet-stream"),
    headers: {
      ...HEADERS,
      "cache-control": IMMUTABLE_CACHE_CONTROL,
    },
  });
})();

const registerPublicFileServingRoutes = Effect.fn("registerPublicFileServingRoutes")(function* () {
  const router = yield* HttpRouter.HttpRouter;

  yield* router.add(
    "GET",
    "/files/*",
    handleServe.pipe(
      // catchCause so store defects are logged with their full cause instead of
      // escaping the worker as an opaque exception.
      Effect.catchCause((cause) =>
        Effect.fn("registerPublicFileServingRoutes")(function* () {
          yield* Effect.logError(`Public file serving error: ${Cause.pretty(cause)}`);
          return yield* HttpServerResponse.json(
            { error: "Failed to load file" },
            { headers: HEADERS, status: 502 },
          );
        })(),
      ),
    ),
  );
})();

export const PublicFileServingRouteLayer = Layer.effectDiscard(registerPublicFileServingRoutes);
