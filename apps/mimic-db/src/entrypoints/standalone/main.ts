// oxlint-disable-next-line effect/noNodeBuiltinImport -- the created server is handed to NodeHttpServer.layer, which requires a real http.Server instance.
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
    // oxlint-disable-next-line effect/noAs -- see the comment above: HttpServerRequest leaks out of the RPC handler layer into the launched program's requirements even though the RPC server supplies it per call; the assertion is the upstream typing escape hatch.
    return yield* (makeHttpApp(LocalHostServiceDefault).pipe(
      Layer.provide(NodeHttpServer.layer(() => createServer(), { port })),
      Layer.launch,
    ) as Effect.Effect<never, unknown>);
  }),
);
