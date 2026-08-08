// oxlint-disable-next-line effect/noNodeBuiltinImport -- the created server is handed to NodeHttpServer.layer and to the WebSocket upgrade installer, both of which require a real http.Server instance.
import { createServer } from "node:http";

import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { HostServiceTag } from "@voidhash/mimic-db/app/hostService";
import { getConfig } from "@voidhash/mimic-db/config";
import { makeRoutesLive } from "@voidhash/mimic-db/http/rpc-app";
import {
  DurableEntityAlarmControl,
  DurableEntityHost,
} from "@voidhash/platform/DurableEntity";
import { Config, Context, Effect, Layer } from "effect";
import { HttpRouter } from "effect/unstable/http";

import { makeSelfhostPlatformLayers } from "../backend/PlatformProfile.ts";
import { getSelfhostPlatformDatabaseConfig } from "../config.ts";
import { getMimicNodeConfig } from "./config.ts";
import { makeSelfhostMimicDocumentIdlePublisher } from "./MimicDocumentIdleQueue.ts";
import { makeMimicNodeHostLive } from "./MimicNode.ts";
import { installMimicNodeWebSocketServer } from "./MimicNodeWebSocket.ts";

const config = getMimicNodeConfig();
// Idle-document notifications are produced here and consumed by the backend, so
// this process has to publish onto the same queue the backend installs there.
// Resolving the composition through the shared module is what keeps a split
// deployment from silently dropping every message.
const platform = makeSelfhostPlatformLayers({
  platformDatabase: getSelfhostPlatformDatabaseConfig(),
});
const hostLayer = makeMimicNodeHostLive(config, platform.durableEntities);

NodeRuntime.runMain(
  // oxlint-disable-next-line effect/noAs -- see the comment at the closing `as never`: HttpRouter.toHttpEffect leaks HttpServerRequest into the program requirements even though makeHandler supplies it per request; the assertion is the upstream typing escape hatch.
  Effect.scoped(
    Effect.gen(function* () {
      const port = yield* Config.port("PORT").pipe(Config.withDefault(5001), Effect.orDie);
      const hostContext = yield* Layer.build(hostLayer);
      const host = Context.get(hostContext, HostServiceTag);
      const entities = Context.get(hostContext, DurableEntityHost);
      const entityControl = Context.get(hostContext, DurableEntityAlarmControl);
      const queueContext = yield* Layer.build(Layer.merge(platform.queue, platform.runtime));
      const publishIdleDocument = yield* makeSelfhostMimicDocumentIdlePublisher.pipe(
        Effect.provide(queueContext),
      );
      const server = createServer();
      const httpEffect = yield* makeRoutesLive(Layer.succeed(HostServiceTag, host)).pipe(
        Layer.provide(NodeHttpServer.layerHttpServices),
        HttpRouter.toHttpEffect,
      );
      const scope = yield* Effect.scope;
      const handler = yield* NodeHttpServer.makeHandler(httpEffect, { scope });
      server.on("request", handler);
      const closeWebSockets = installMimicNodeWebSocketServer(
        server,
        host,
        entities,
        {
          control: entityControl,
          debounceMs: getConfig().idleNotifyDebounceMs,
          publish: publishIdleDocument,
        },
      );
      yield* Effect.acquireRelease(
        Effect.callback<void, Error>((resume) => {
          const onError = (error: Error) => resume(Effect.fail(error));
          server.once("error", onError);
          server.listen(port, "0.0.0.0", () => {
            server.off("error", onError);
            resume(Effect.void);
          });
        }),
        () =>
          Effect.callback<void>((resume) => {
            if (!server.listening) {
              resume(Effect.void);
              return;
            }
            server.close(() => resume(Effect.void));
          }),
      );
      yield* Effect.addFinalizer(() => Effect.sync(closeWebSockets));
      yield* Effect.logInfo(`Listening on http://0.0.0.0:${port}`);
      yield* Effect.never;
    }),
    // `HttpRouter.toHttpEffect` leaks `HttpServerRequest` into the program's
    // requirements even though `makeHandler` supplies it per request; the
    // assertion is the upstream typing escape hatch.
  ) as never,
);
