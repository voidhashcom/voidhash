import { Command, Prompt } from "effect/unstable/cli";
import { Console, Effect } from "effect";

import { Auth } from "../../domain/services/auth";

export const loginCommand = Command.make("login", {}, () =>
  Effect.gen(function* loginCommand() {
    const auth = yield* Auth;
    const user = yield* auth.getSignedInSession.pipe(
      Effect.catchTags({
        FailedToGetSessionError: () =>
          Effect.succeed(null).pipe(
            Effect.tap(() =>
              Console.log(
                "Failed to get currect user session. Acting as if the user is not logged in.",
              ),
            ),
          ),
        NoSignedInUserError: () => Effect.succeed(null),
      }),
    );

    if (user) {
      const shouldContinue = yield* Prompt.run(
        Prompt.confirm({
          message: `You are already logged in as ${user.name}. You will be logged out. Do you want to continue?`,
        }),
      );
      if (!shouldContinue) {
        return yield* Console.log("Login cancelled.");
      }
      return yield* auth.logout.pipe(
        Effect.catchTags({
          FailedToLogoutError: () =>
            Effect.succeed(null).pipe(Effect.tap(() => Console.log("Failed to logout."))),
        }),
      );
    }

    return yield* auth.login.pipe(
      Effect.catchTags({
        FailedToLoginError: () =>
          Effect.void.pipe(Effect.tap(() => Console.log("Failed to login. Please try again."))),
        LoginCancelledError: () =>
          Effect.void.pipe(Effect.tap(() => Console.log("Login cancelled."))),
      }),
    );
  }),
).pipe(Command.withDescription("Login to the Voidhash CLI."));
