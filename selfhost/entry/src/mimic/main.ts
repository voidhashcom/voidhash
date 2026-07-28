import { createServer } from "node:http";

import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { HostServiceTag } from "@voidhash/mimic-db/app/hostService";
import { getConfig } from "@voidhash/mimic-db/config";
import { makeRoutesLive } from "@voidhash/mimic-db/http/rpc-app";
import { DurableEntityHost } from "@orbian/sdk/DurableEntity";
import {
  NodeDurableEntityControl,
} from "@orbian/node/DurableEntity";
import { NodePlatformRuntimeLive } from "@orbian/node/PlatformRuntime";
import { PgQueueLive } from "@orbian/node/Queue";
import { Context, Effect, Layer } from "effect";
import { HttpRouter } from "effect/unstable/http";

import { getMimicNodeConfig } from "./config.ts";
import { makeSelfhostMimicDocumentIdlePublisher } from "./MimicDocumentIdleQueue.ts";
import { makeMimicNodeHostLive } from "./MimicNode.ts";
import { installMimicNodeWebSocketServer } from "./MimicNodeWebSocket.ts";

const port = Number(process.env.PORT ?? "5001");
const config = getMimicNodeConfig();
const hostLayer = makeMimicNodeHostLive(config);

NodeRuntime.runMain(
  Effect.scoped(
    Effect.gen(function* () {
      const hostContext = yield* Layer.build(hostLayer);
      const host = Context.get(hostContext, HostServiceTag);
      const entities = Context.get(hostContext, DurableEntityHost);
      const entityControl = Context.get(hostContext, NodeDurableEntityControl);
      const queueContext = yield* Layer.build(
        Layer.merge(PgQueueLive(config.database), NodePlatformRuntimeLive),
      );
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
  ) as never,
);
