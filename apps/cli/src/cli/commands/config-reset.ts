import { Command } from "effect/cli";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";

import { CliConfig } from "../../domain/services/cli-config";
import { userError } from "../../utils/error-formatter";

export const configResetCommand = Command.make("reset", {}, () =>
  Effect.gen(function* configResetCommand() {
    const cliConfig = yield* CliConfig;

    yield* cliConfig
      .resetConfig()
      .pipe(
        Effect.catchTag("SchemaError", () => Effect.fail(userError("Failed to set configuration"))),
      );
    yield* Console.log("Configuration reset successfully.");
  }),
).pipe(
  Command.withDescription(
    "Reset the Voidhash configuration to the default values. Stored sign-ins are kept; to sign out, use the `logout` command.",
  ),
);
