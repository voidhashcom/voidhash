import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as References from "effect/References";
import { Command } from "effect/cli";
import { FetchHttpClient } from "effect/http";

import { Auth } from "../domain/services/auth";
import { CliConfig } from "../domain/services/cli-config";
import { Codegen } from "../domain/services/codegen";
import { CredentialStore } from "../domain/services/credential-store";
import { Credentials } from "../domain/services/credentials";
import { SchemaService } from "../domain/services/schema";
import { SourceCode } from "../domain/services/source-code";
import { ApiClient } from "../utils/api-client";
import { exitCodeTeardown, isDebugMode, reportFailures } from "../utils/error-formatter";
import { rootCommand, VERSION } from "./root";

const cli = Command.run(rootCommand, { version: VERSION });

// Apply debug log level if --debug flag is present
const withDebugLogLevel = <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> => {
  if (!isDebugMode()) return effect;
  return effect.pipe(Effect.provideService(References.MinimumLogLevel, "Debug"));
};

const ServicesLayer = Layer.mergeAll(
  SourceCode.Default,
  Auth.Default,
  Codegen.Default,
  SchemaService.Default,
);

const PlatformLayer = Layer.mergeAll(NodeServices.layer, FetchHttpClient.layer);

const MainLayer = ServicesLayer.pipe(
  Layer.provideMerge(ApiClient.Default),
  Layer.provideMerge(Credentials.layer),
  Layer.provideMerge(CredentialStore.Default),
  Layer.provideMerge(CliConfig.Default),
  Layer.provideMerge(PlatformLayer),
);

NodeRuntime.runMain(withDebugLogLevel(cli).pipe(reportFailures, Effect.provide(MainLayer)), {
  teardown: exitCodeTeardown,
});
