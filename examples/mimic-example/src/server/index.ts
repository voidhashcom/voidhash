import { createServer } from "node:http";
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { Config, Effect, Layer } from "effect";
import { AppLive } from "./app";

// Specify the port
const ServerLive = Layer.unwrap(
  Effect.gen(function* () {
    const port = yield* Config.int("PORT").pipe(Config.withDefault(3001));
    return NodeHttpServer.layer(() => createServer(), { port });
  }),
);

NodeRuntime.runMain(AppLive.pipe(Layer.provide(ServerLive), Layer.launch));
