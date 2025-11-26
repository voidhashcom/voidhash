import { Command, Prompt } from '@effect/cli';
import { Console, Effect } from 'effect';
import { Auth } from '../../domain/services/auth';

export const logoutCommand = Command.make('logout', {}, () =>
  Effect.gen(function* () {
    const auth = yield* Auth;
    const user = yield* auth.getSignedInSession.pipe(
      Effect.catchTags({
        NoSignedInUserError: () => Effect.succeed(null),
        FailedToGetSessionError: () =>
          Effect.succeed(null).pipe(
            Effect.tap(() =>
              Console.log(
                'Failed to get current user session. We will still proceed with logout.'
              )
            )
          )
      })
    );

    if (user) {
      const shouldContinue = yield* Prompt.run(
        Prompt.confirm({
          message: `You are currently logged in as ${user.name}. You will be logged out. Do you want to continue?`
        })
      );
      if (!shouldContinue) {
        return yield* Console.log('Login cancelled.');
      }
      return yield* auth.logout;
    }

    return yield* Console.log('You are not logged in.');
  }).pipe(
    Effect.catchTags({
      FailedToLogoutError: () =>
        Effect.succeed(undefined).pipe(
          Effect.tap(() => Console.log('Failed to logout. Please try again.'))
        )
    })
  )
).pipe(Command.withDescription('Logout from the Voidhash CLI.'));
