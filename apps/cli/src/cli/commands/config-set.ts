import { Argument, Command } from "effect/cli";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";

import { CliConfig } from "../../domain/services/cli-config";
import { userError } from "../../utils/error-formatter";

const keyArg = Argument.String("key");
const valueArg = Argument.String("value");

export const configSetCommand = Command.make(
  "set",
  { key: keyArg, value: valueArg },
  ({ key, value }) =>
    Effect.gen(function* configSetCommand() {
      if (key === "api_key") {
        return yield* Effect.fail(
          userError("Keys are not kept in the config.", {
            hint: "Sign in with 'voidhash-cli login', or set VOIDHASH_API_KEY for scripts and CI.",
          }),
        );
      }
      const cliConfig = yield* CliConfig;
      yield* cliConfig
        .writeToConfig({
          [key]: value,
        })
        .pipe(
          Effect.catchTag("SchemaError", () =>
            Effect.fail(userError("Failed to set configuration")),
          ),
        );
      yield* Console.log("Configuration set successfully.");
    }),
).pipe(Command.withDescription("Set a Voidhash configuration value."));
