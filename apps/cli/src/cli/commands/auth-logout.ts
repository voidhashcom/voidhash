import { Command, Prompt } from '@effect/cli';
import { Console, Effect } from 'effect';
import { getSignedInSession } from '../../utils/login/get-signed-in-user';
import { logout } from '../../utils/login/logout';

export const logoutCommand = Command.make('logout', {}, () =>
  Effect.gen(function* () {
    const user = yield* getSignedInSession.pipe(
      Effect.catchTags({
        NoSignedInUserError: () => Effect.succeed(null)
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
      return yield* logout;
    }

    return yield* Console.log('You are not logged in.');
  })
).pipe(Command.withDescription('Logout from the Voidhash CLI.'));
