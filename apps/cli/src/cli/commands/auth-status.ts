import { Command } from "effect/unstable/cli";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";

import { Auth } from "../../domain/services/auth";
import { userError } from "../../utils/error-formatter";

export const authStatusCommand = Command.make("status", {}, () =>
  Effect.gen(function* authStatusCommand() {
    const auth = yield* Auth;
    const user = yield* auth.getSignedInSession.pipe(
      Effect.catchTags({
        FailedToGetSessionError: () =>
          Effect.fail(
            userError(
              "Failed to get user session. Please try again or run 'voidhash-cli auth login'.",
            ),
          ),
        NoSignedInUserError: () => Effect.succeed(null),
      }),
    );

    if (user) {
      yield* Console.log(`Logged in as ${user.name}`);
    } else {
      yield* Console.log("Not logged in");
    }
  }),
).pipe(Command.withDescription("Check the status of the Voidhash CLI."));
