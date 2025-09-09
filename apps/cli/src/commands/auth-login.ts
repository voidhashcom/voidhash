import { Command, Prompt } from '@effect/cli';
import { Console, Effect } from 'effect';
import { getSignedInSession } from '../utils/login/get-signed-in-user';
import { login } from '../utils/login/login';
import { logout } from '../utils/login/logout';

export const loginCommand = Command.make('login', {}, () =>
  Effect.gen(function* () {
    const user = yield* getSignedInSession.pipe(
      Effect.catchTags({
        NoSignedInUserError: () => Effect.succeed(null)
      })
    );

    if (user) {
      const shouldContinue = yield* Prompt.run(
        Prompt.confirm({
          message: `You are already logged in as ${user.name}. You will be logged out. Do you want to continue?`
        })
      );
      if (!shouldContinue) {
        yield* Console.log('Login cancelled.');
        return;
      }
      yield* logout;
    }

    yield* login;
  })
).pipe(Command.withDescription('Login to the Voidhash CLI.'));
