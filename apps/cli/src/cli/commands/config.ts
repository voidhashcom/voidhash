import { Command } from "effect/unstable/cli";
import { Console, Effect } from "effect";

import { CliConfig } from "../../domain/services/cli-config";
import { getActiveProfile } from "../../utils/error-formatter";
import { configResetCommand } from "./config-reset";
import { configSetCommand } from "./config-set";

export const configCommand = Command.make("config", {}, () =>
  Effect.gen(function* configCommand() {
    const cliConfig = yield* CliConfig;
    const activeProfile = getActiveProfile();

    if (activeProfile) {
      yield* Console.log(`Active profile: ${activeProfile}`);
    }
    yield* Console.log("Current configuration:");
    const config = yield* cliConfig.readConfig();

    for (const [key, value] of Object.entries(config)) {
      // Print the key/value in italic and different color (cyan)
      if (value == null) {
        yield* Console.log(`${key}: \u001B[36m\u001B[3m(not set)\u001B[0m`);
      } else {
        yield* Console.log(`${key}: ${value}`);
      }
    }

    const raw = yield* cliConfig.readRawConfig();
    const profileNames = Object.keys(raw.profiles ?? {});
    if (profileNames.length > 0) {
      yield* Console.log(`\nProfiles: ${profileNames.join(", ")}`);
    }
  }),
).pipe(
  Command.withDescription("Manage the Voidhash authentication."),
  Command.withSubcommands([configSetCommand, configResetCommand]),
);
