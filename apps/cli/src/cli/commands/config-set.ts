import { Argument, Command } from "effect/unstable/cli";
import { Console, Effect } from "effect";

import { CliConfig } from "../../domain/services/cli-config";
import { userError } from "../../utils/error-formatter";

const keyArg = Argument.string("key");
const valueArg = Argument.string("value");

export const configSetCommand = Command.make(
  "set",
  { key: keyArg, value: valueArg },
  ({ key, value }) =>
    Effect.gen(function* configSetCommand() {
      const cliConfig = yield* CliConfig;
      yield* cliConfig
        .writeToConfig({
          [key]: value,
        })
        .pipe(
          Effect.catchTag("SchemaError", () =>
            Effect.fail(
              userError("Failed to set configuration")
            )
          )
        );
      yield* Console.log("Configuration set successfully.");
    })
).pipe(Command.withDescription("Set a Voidhash configuration value."));
