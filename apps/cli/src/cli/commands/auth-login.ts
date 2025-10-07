import { Command, Prompt } from '@effect/cli';
import { Console, Effect } from 'effect';
import { Auth } from '../../domain/services/auth';

export const loginCommand = Command.make('login', {}, () =>
  Effect.gen(function* () {
    const auth = yield* Auth;
    const user = yield* auth.getSignedInSession.pipe(
      Effect.catchTags({
        NoSignedInUserError: () => Effect.succeed(null),
        FailedToGetSessionError: () =>
          Effect.succeed(null).pipe(
            Effect.tap(() =>
              Console.log(
                'Failed to get currect user session. Acting as if the user is not logged in.'
              )
            )
          )
      })
    );

    if (user) {
      const shouldContinue = yield* Prompt.run(
        Prompt.confirm({
          message: `You are already logged in as ${user.name}. You will be logged out. Do you want to continue?`
        })
      );
      if (!shouldContinue) {
        return yield* Console.log('Login cancelled.');
      }
      return yield* auth.logout.pipe(
        Effect.catchTags({
          FailedToLogoutError: () =>
            Effect.succeed(null).pipe(
              Effect.tap(() => Console.log('Failed to logout.'))
            )
        })
      );
    }

    return yield* auth.login.pipe(
      Effect.catchTags({
        LoginCancelledError: () =>
          Effect.succeed(undefined).pipe(
            Effect.tap(() => Console.log('Login cancelled.'))
          ),
        FailedToLoginError: () =>
          Effect.succeed(undefined).pipe(
            Effect.tap(() => Console.log('Failed to login. Please try again.'))
          )
      })
    );
  })
).pipe(Command.withDescription('Login to the Voidhash CLI.'));
