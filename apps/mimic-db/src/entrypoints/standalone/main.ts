import { createServer } from "node:http";

import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { Layer } from "effect";

import { LocalHostServiceDefault } from "../../core/local-host-service.ts";
import { makeHttpApp } from "../../http/rpc-app.ts";

/**
 * Local standalone dev server: serves the RPC API over Node HTTP backed by the
 * in-memory `HostService`. Production entry points provide persistent platform
 * adapters over the same application.
 */
const port = Number(process.env.PORT ?? "5001");

NodeRuntime.runMain(
  makeHttpApp(LocalHostServiceDefault).pipe(
    Layer.provide(NodeHttpServer.layer(() => createServer(), { port })),
    Layer.launch,
  ) as never,
);
