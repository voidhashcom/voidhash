import { MimicRpcGroup } from "@voidhash/mimic-server/rpc";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { HttpRouter, HttpServerResponse } from "effect/unstable/http";
import { RpcSerialization, RpcServer } from "effect/unstable/rpc";

import { ApiHandlersLive } from "../api/handlers/index.ts";
import { AuthMiddlewareLive } from "../api/middleware/auth.ts";
import { HostServiceTag } from "../app/hostService.ts";
import { getCorsAllowedOrigins } from "../config.ts";

/** `GET /health` → `200 OK`. */
export const HealthRoute = Layer.effectDiscard(
  Effect.gen(function* () {
    const router = yield* HttpRouter.HttpRouter;
    yield* router.add("GET", "/health", HttpServerResponse.text("OK"));
  }),
);

/**
 * The `MimicRpcGroup` served at `/rpc/v1` over NDJSON with HTTP Basic auth —
 * the exact wire contract clients (and the backend SDK) expect. Still requires
 * a `HostService` to be provided.
 */
export const MimicRpcServerLive = RpcServer.layerHttp({
  group: MimicRpcGroup,
  path: "/rpc/v1",
  protocol: "http",
}).pipe(
  Layer.provide(ApiHandlersLive),
  Layer.provide(AuthMiddlewareLive),
  Layer.provide(RpcSerialization.layerNdjson),
);

/** Compose the public HTTP routes (health + RPC) over a `HostService` layer. */
export const makeRoutesLive = (hostLayer: Layer.Layer<HostServiceTag>) =>
  Layer.mergeAll(HealthRoute, MimicRpcServerLive.pipe(Layer.provide(hostLayer))).pipe(
    Layer.provide(HttpRouter.cors({ allowedOrigins: getCorsAllowedOrigins(), credentials: true })),
  );

/** A served HTTP app for the given `HostService` layer (needs an HttpServer). */
export const makeHttpApp = (hostLayer: Layer.Layer<HostServiceTag>) =>
  HttpRouter.serve(makeRoutesLive(hostLayer));
