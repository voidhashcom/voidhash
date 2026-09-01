/**
 * Public paywall artifact serving — `GET /p/:contentHash/*` (deploy contract
 * §5) and `GET /c/:contentHash/*` (§5.1).
 *
 * Released artifacts are public, immutable, and content-addressed: the
 * finalize step copies paywall blobs to `p/<contentHash>/index.html`,
 * `p/<contentHash>/bundle.js`, and `p/<contentHash>/assets/<name>`, and
 * component blobs to `c/<contentHash>/manifest.json`,
 * `c/<contentHash>/previews/<state>.json`, `c/<contentHash>/runtime.js`, and
 * `c/<contentHash>/panel.js` in the {@link PaywallArtifactStore}. These routes
 * stream them back with the stored `Content-Type`, an immutable cache policy,
 * permissive CORS, and the §5 security headers (CSP sandbox / nosniff /
 * no-referrer — tenant HTML is co-hosted with the authenticated API origin) —
 * no auth (the contentHash itself is the capability).
 */
import { PaywallArtifactStore } from "@voidhash/core/services";
import { SHA256_HEX_PATTERN } from "@voidhash/core/services/paywallDeploys/PaywallDeployManifest";
import { constant } from "@voidhash/lib/lang";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { HttpRouter, HttpServerResponse } from "effect/unstable/http";
import * as Str from "effect/String";

const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

/**
 * Security headers stamped on EVERY `/p/*` and `/c/*` response (contract §5).
 * The CSP `sandbox` directive forces tenant-authored HTML served from this
 * (API) origin into an opaque origin: no same-origin credentialed API access,
 * no `document.cookie`. `allow-scripts allow-forms` keeps the paywall runtime
 * functional; nosniff + no-referrer close the type-confusion and URL-leak
 * side channels.
 */
const SECURITY_HEADERS = constant({
  "content-security-policy": "sandbox allow-scripts allow-forms",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
});

/**
 * 404/error responses carry CORS too (contract §5.1): cross-origin consumers
 * (the studio fetching preview trees) must observe a readable 404 instead of
 * an opaque CORS failure.
 */
const ERROR_HEADERS = constant({
  ...SECURITY_HEADERS,
  "access-control-allow-origin": "*",
});

const notFound = HttpServerResponse.json(
  { error: "Not found" },
  { headers: ERROR_HEADERS, status: 404 },
);

const handleServe = (prefix: "p" | "c") =>
  Effect.gen(function* () {
    const store = yield* PaywallArtifactStore;
    const params = yield* HttpRouter.params;

    const contentHash = params.contentHash;
    const rest = params["*"];
    // The serving layouts only ever contain lowercase-hex contentHash
    // prefixes (§1.2); anything else can 404 without touching the store. `..`
    // has no traversal semantics in object storage, but reject it anyway so
    // the route never echoes a creative key back into the store.
    if (
      contentHash === undefined ||
      !SHA256_HEX_PATTERN.test(contentHash) ||
      rest === undefined ||
      Str.isEmpty(rest) ||
      rest.split("/").some((segment) => Str.isEmpty(segment) || segment === "..")
    ) {
      return yield* notFound;
    }

    const object = yield* store.getObject(`${prefix}/${contentHash}/${rest}`);
    if (Option.isNone(object)) {
      return yield* notFound;
    }

    return HttpServerResponse.uint8Array(object.value.body, {
      contentType: Option.getOrElse(object.value.contentType, () => "application/octet-stream"),
      headers: {
        ...SECURITY_HEADERS,
        "access-control-allow-origin": "*",
        "cache-control": IMMUTABLE_CACHE_CONTROL,
      },
    });
  });

const registerPaywallServingRoutes = Effect.fn("registerPaywallServingRoutes")(function* () {
  const router = yield* HttpRouter.HttpRouter;

  yield* Effect.forEach(constant(["p", "c"]), Effect.fn("iterate")(function* (prefix) {
yield* router.add(
      "GET",
      `/${prefix}/:contentHash/*`,
      handleServe(prefix).pipe(
        // catchCause so store defects are logged with their full cause instead
        // of escaping the worker as an opaque exception.
        Effect.catchCause((cause) =>
          Effect.fn("registerPaywallServingRoutes")(function* () {
            yield* Effect.logError(`Paywall artifact serving error: ${Cause.pretty(cause)}`);
            return yield* HttpServerResponse.json(
              { error: "Failed to load paywall artifact" },
              { headers: ERROR_HEADERS, status: 502 },
            );
          })(),
        ),
      ),
    );
}), { concurrency: 1 });
})();

export const PaywallServingRouteLayer = Layer.effectDiscard(registerPaywallServingRoutes);
