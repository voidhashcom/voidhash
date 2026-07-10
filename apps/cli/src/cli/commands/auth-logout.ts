import { Command, Prompt } from "effect/unstable/cli";
import { Console, Effect } from "effect";

import { Auth } from "../../domain/services/auth";

export const logoutCommand = Command.make("logout", {}, () =>
  Effect.gen(function* logoutCommand() {
    const auth = yield* Auth;
    const user = yield* auth.getSignedInSession.pipe(
      Effect.catchTags({
        FailedToGetSessionError: () =>
          Effect.succeed(null).pipe(
            Effect.tap(() =>
              Console.log("Failed to get current user session. We will still proceed with logout."),
            ),
          ),
        NoSignedInUserError: () => Effect.succeed(null),
      }),
    );

    if (user) {
      const shouldContinue = yield* Prompt.run(
        Prompt.confirm({
          message: `You are currently logged in as ${user.name}. You will be logged out. Do you want to continue?`,
        }),
      );
      if (!shouldContinue) {
        return yield* Console.log("Login cancelled.");
      }
    }
    return yield* auth.logout;
  }).pipe(
    Effect.catchTags({
      FailedToLogoutError: () =>
        Effect.void.pipe(Effect.tap(() => Console.log("Failed to logout. Please try again."))),
    }),
  ),
).pipe(Command.withDescription("Logout from the Voidhash CLI."));
