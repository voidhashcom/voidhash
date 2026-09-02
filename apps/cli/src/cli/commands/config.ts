import { Command } from "effect/unstable/cli";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";

import { CliConfig } from "../../domain/services/cli-config";
import { getActiveProfile } from "../../utils/error-formatter";
import { configResetCommand } from "./config-reset";
import { configSetCommand } from "./config-set";
import * as R from "effect/Record";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";

export const configCommand = Command.make("config", {}, () =>
  Effect.gen(function* configCommand() {
    const cliConfig = yield* CliConfig;
    const activeProfile = Option.getOrElse(getActiveProfile(), () => "");

    if (activeProfile) {
      yield* Console.log(`Active profile: ${activeProfile}`);
    }
    yield* Console.log("Current configuration:");
    const config = yield* cliConfig.readConfig();

    yield* Effect.forEach(
      R.toEntries(config),
      Effect.fn("iterate")(function* ([key, value]) {
        // Print the key/value in italic and different color (cyan)
        if (value == null) {
          yield* Console.log(`${key}: \u001B[36m\u001B[3m(not set)\u001B[0m`);
        } else {
          yield* Console.log(`${key}: ${value}`);
        }
      }),
      { concurrency: 1 },
    );

    const raw = yield* cliConfig.readRawConfig();
    const profileNames = R.keys(raw.profiles ?? {});
    if (Arr.isReadonlyArrayNonEmpty(profileNames)) {
      yield* Console.log(`\nProfiles: ${profileNames.join(", ")}`);
    }
  }),
).pipe(
  Command.withDescription("Manage the Voidhash authentication."),
  Command.withSubcommands([configSetCommand, configResetCommand]),
);
