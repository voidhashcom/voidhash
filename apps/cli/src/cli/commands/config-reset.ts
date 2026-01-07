import { Command, HelpDoc, ValidationError } from "@effect/cli";
import { Console, Effect } from "effect";

import { CliConfig } from "../../domain/services/cli-config";

export const configResetCommand = Command.make("reset", {}, () =>
  Effect.gen(function* configResetCommand() {
    const cliConfig = yield* CliConfig;

    yield* cliConfig
      .resetConfig()
      .pipe(
        Effect.catchTag("ParseError", () =>
          Effect.fail(
            ValidationError.invalidValue(
              HelpDoc.p("Failed to set configuration")
            )
          )
        )
      );
    yield* Console.log("Configuration reset successfully.");
  })
).pipe(
  Command.withDescription(
    "Reset the Voidhash configuration to the default values. If authenticated, persists the authentication state. For logout, use the `auth logout` command."
  )
);
