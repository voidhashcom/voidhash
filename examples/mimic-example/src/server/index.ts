import { createServer } from "node:http";
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { Layer } from "effect";
import { AppLive } from "./app";

// Specify the port
const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3001;

NodeRuntime.runMain(
  AppLive.pipe(
    Layer.provide(
      NodeHttpServer.layer(() => createServer(), {
        port,
      }),
    ),
    Layer.launch,
  ) as never,
);
