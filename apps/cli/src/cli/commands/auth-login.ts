import { Command, Flag } from "effect/cli";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";

import { FailedToStoreCredentialError } from "../../domain/errors/auth";
import { Auth } from "../../domain/services/auth";
import { ExitCode, userError } from "../../utils/error-formatter";

const readOnlyFlag = Flag.Boolean("read-only").pipe(
  Flag.withDescription("Sign in read-only: commands can look but not change anything"),
  Flag.withDefault(false),
);

const noBrowserFlag = Flag.Boolean("no-browser").pipe(
  Flag.withDescription("Print the sign-in address and code without opening a browser"),
  Flag.withDefault(false),
);

/** `voidhash-cli login [--read-only] [--no-browser]`, also `voidhash-cli auth login`. */
export const loginCommand = Command.make(
  "login",
  { readOnly: readOnlyFlag, noBrowser: noBrowserFlag },
  ({ readOnly, noBrowser }) =>
    Effect.gen(function* loginCommand() {
      yield* (yield* Auth).login({ readOnly, noBrowser });
    }).pipe(
      Effect.catchTags({
        DeviceLoginError: (error) =>
          Effect.fail(
            userError(error.message, {
              hint: Match.value(error.reason).pipe(
                Match.when("denied", () => "Run 'voidhash-cli login' again to sign in."),
                Match.orElse(() => "Run 'voidhash-cli login' again for a new code."),
              ),
              exitCode: ExitCode.unauthenticated,
            }),
          ),
        FailedToLoginError: (error) =>
          Effect.fail(
            error.cause instanceof FailedToStoreCredentialError
              ? userError(error.message, {
                  hint: "Make sure you can write to that file, then run 'voidhash-cli login' again.",
                })
              : userError(`Could not sign in: ${error.message}`, {
                  hint: "Check your connection and the API URL ('voidhash-cli config'), then try again.",
                }),
          ),
      }),
    ),
).pipe(
  Command.withDescription(
    "Sign in by approving a code in your browser; the CLI then acts as you. Works over SSH and in containers.",
  ),
);
