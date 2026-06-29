import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect, Layer, References } from "effect";
import { Command } from "effect/unstable/cli";
import { FetchHttpClient } from "effect/unstable/http";

import { Auth } from "../domain/services/auth";
import { CliConfig } from "../domain/services/cli-config";
import { Codegen } from "../domain/services/codegen";
import { SchemaService } from "../domain/services/schema";
import { SourceCode } from "../domain/services/source-code";
import { ApiClient } from "../utils/api-client";
import {
  isDebugMode,
  withValidationErrorHandler,
} from "../utils/error-formatter";
import { authCommand } from "./commands/auth";
import { configCommand } from "./commands/config";
import { deployCommand } from "./commands/deploy";
import { initCommand } from "./commands/init";
import { studioCommand } from "./commands/studio";
import { typesCommand } from "./commands/types";
import { debugOption, profileOption } from "./shared-options";

const command = Command.make(
  "voidhash",
  { debug: debugOption },
  () => Effect.void,
).pipe(
  Command.withDescription("Voidhash CLI application."),
  // Shared flags are accepted before and after the subcommand name (npm-style),
  // so `voidhash deploy --profile dev` and `voidhash --profile dev deploy` both
  // parse. Must be applied before withSubcommands.
  Command.withSharedFlags({ profile: profileOption }),
  Command.withSubcommands([
    initCommand,
    authCommand,
    typesCommand,
    configCommand,
    studioCommand,
    deployCommand,
  ]),
);

const cli = Command.run(command, {
  version: "0.0.1-alpha.1",
});

// Apply debug log level if --debug flag is present
const cliEffect = cli.pipe(
  isDebugMode()
    ? Effect.provideService(References.MinimumLogLevel, "Debug")
    : (x) => x,
);

const ServicesLayer = Layer.mergeAll(
  SourceCode.Default,
  Auth.Default,
  Codegen.Default,
  SchemaService.Default,
);

const PlatformLayer = Layer.mergeAll(NodeServices.layer, FetchHttpClient.layer);

const MainLayer = ServicesLayer.pipe(
  Layer.provideMerge(ApiClient.Default),
  Layer.provideMerge(CliConfig.Default),
  Layer.provideMerge(PlatformLayer),
);

NodeRuntime.runMain(
  cliEffect.pipe(Effect.provide(MainLayer), withValidationErrorHandler),
);
