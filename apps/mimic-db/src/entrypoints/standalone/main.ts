import { createServer } from "node:http";

import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { Config, Effect, Layer } from "effect";

import { LocalHostServiceDefault } from "../../core/local-host-service.ts";
import { makeHttpApp } from "../../http/rpc-app.ts";

/**
 * Local standalone dev server: serves the RPC API over Node HTTP backed by the
 * in-memory `HostService`. Production entry points provide persistent platform
 * adapters over the same application.
 */
NodeRuntime.runMain(
  Effect.gen(function* () {
    const port = yield* Config.number("PORT").pipe(Config.withDefault(5001));
    // `HttpServerRequest` leaks out of the RPC handler layer (handlers read the
    // incoming request); the RPC server supplies it per call at runtime.
    return yield* (makeHttpApp(LocalHostServiceDefault).pipe(
      Layer.provide(NodeHttpServer.layer(() => createServer(), { port })),
      Layer.launch,
    ) as Effect.Effect<never, unknown>);
  }),
);
