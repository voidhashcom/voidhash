import { Command } from "effect/cli";
import * as Effect from "effect/Effect";

import { Auth } from "../../domain/services/auth";
import { userError } from "../../utils/error-formatter";

/** `voidhash-cli logout`, also `voidhash-cli auth logout`. */
export const logoutCommand = Command.make("logout", {}, () =>
  Effect.gen(function* logoutCommand() {
    yield* (yield* Auth).logout;
  }).pipe(
    Effect.catchTags({
      FailedToLogoutError: (error) =>
        Effect.fail(userError(`Could not sign out: ${error.message}`)),
    }),
  ),
).pipe(
  Command.withDescription(
    "Sign out on this computer, and end the CLI's session on the server when it can be reached.",
  ),
);
