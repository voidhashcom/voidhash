import { Args, Command, HelpDoc, ValidationError } from "@effect/cli";
import { Console, Effect } from "effect";

import { CliConfig } from "../../domain/services/cli-config";

const keyArg = Args.text({ name: "key" });
const valueArg = Args.text({ name: "value" });

export const configSetCommand = Command.make(
  "set",
  { key: keyArg, value: valueArg },
  ({ key, value }) =>
    Effect.gen(function* configSetCommand() {
      const cliConfig = yield* CliConfig;
      const config = yield* cliConfig.readConfig();
      yield* cliConfig
        .writeToConfig({
          ...config,
          [key]: value,
        })
        .pipe(
          Effect.catchTag("ParseError", () =>
            Effect.fail(
              ValidationError.invalidValue(
                HelpDoc.p("Failed to set configuration")
              )
            )
          )
        );
      yield* Console.log("Configuration set successfully.");
    })
).pipe(Command.withDescription("Set a Voidhash configuration value."));
