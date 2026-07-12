import { Effect, Layer, Logger } from "effect";
import { Command } from "effect/unstable/cli";
import { layer as NodeChildProcessSpawnerLayer } from "@effect/platform-node-shared/NodeChildProcessSpawner";
import { layer as NodeFileSystemLayer } from "@effect/platform-node-shared/NodeFileSystem";
import { layer as NodePathLayer } from "@effect/platform-node-shared/NodePath";
import { layer as NodeStdioLayer } from "@effect/platform-node-shared/NodeStdio";
import { layer as NodeTerminalLayer } from "@effect/platform-node-shared/NodeTerminal";

import { ConfigLoader } from "../services/ConfigLoader.js";
import { MigrationBundler } from "../services/MigrationBundler.js";
import { MigrationLoader } from "../services/MigrationLoader.js";
import { isDebugMode, withErrorHandler } from "../utils/error-formatter.js";
import { generateCommand } from "./commands/generate.js";
import { initCommand } from "./commands/init.js";
import { migrateCommand } from "./commands/migrate.js";

const command = Command.make("mimic").pipe(
  Command.withDescription("Mimic CLI - manage your Mimic migrations"),
  Command.withSubcommands([initCommand, generateCommand, migrateCommand]),
);

const cliEffect = Command.run(command, {
  version: process.env.MIMIC_CLI_VERSION ?? "1.0.0-beta.19",
}).pipe(isDebugMode() ? Effect.withLogger(Logger.consolePretty()) : (effect) => effect);

const NodeEnvLayer = Layer.mergeAll(
  NodeFileSystemLayer,
  NodePathLayer,
  NodeStdioLayer,
  NodeTerminalLayer,
  NodeChildProcessSpawnerLayer.pipe(
    Layer.provide(Layer.mergeAll(NodeFileSystemLayer, NodePathLayer)),
  ),
);

const MainLayer = Layer.mergeAll(
  ConfigLoader.Default,
  MigrationLoader.Default,
  MigrationBundler.Default,
  NodeEnvLayer,
);

cliEffect
  .pipe(Effect.provide(MainLayer), withErrorHandler, Effect.runPromise)
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
