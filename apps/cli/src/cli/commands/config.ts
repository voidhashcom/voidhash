import { Command } from "effect/cli";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";

import { CliConfig } from "../../domain/services/cli-config";
import {
  Credentials,
  describeCredentialSource,
  maskToken,
} from "../../domain/services/credentials";
import { configResetCommand } from "./config-reset";
import { configSetCommand } from "./config-set";
import * as R from "effect/Record";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";

export const configCommand = Command.make("config", {}, () =>
  Effect.gen(function* configCommand() {
    const cliConfig = yield* CliConfig;
    const credentials = yield* Credentials;
    const activeProfile = cliConfig.activeProfile;

    if (activeProfile) {
      yield* Console.log(`Active profile: ${activeProfile}`);
    }
    yield* Console.log("Current configuration:");
    const config = yield* cliConfig.readConfig();
    // Never the token itself: only enough of it to tell two apart.
    const credential = Option.map(
      yield* credentials.resolve(config.api_url).pipe(Effect.option, Effect.map(Option.flatten)),
      ({ token, source }) =>
        `${maskToken(token)} (from ${describeCredentialSource(source, credentials.filePath)})`,
    );
    const settings = [
      ["credential", Option.getOrNull(credential)],
      ["api_url", config.api_url],
      ["web_url", config.web_url],
      ["default_project", config.default_project],
    ] as const;

    yield* Effect.forEach(
      settings,
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
    const links = R.toEntries(config.links ?? {});
    if (Arr.isReadonlyArrayNonEmpty(links)) {
      yield* Console.log(
        ["links:", ...links.map(([directory, projectId]) => `  ${directory}  ${projectId}`)].join(
          "\n",
        ),
      );
    }

    const raw = yield* cliConfig.readRawConfig();
    const profileNames = R.keys(raw.profiles ?? {});
    if (Arr.isReadonlyArrayNonEmpty(profileNames)) {
      yield* Console.log(`\nProfiles: ${profileNames.join(", ")}`);
    }
  }),
).pipe(
  Command.withDescription(
    "Show the CLI settings: API and dashboard URLs, credentials, default project and links.",
  ),
  Command.withSubcommands([configSetCommand, configResetCommand]),
);
