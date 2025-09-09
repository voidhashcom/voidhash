import { Command } from '@effect/cli';
import { Console, Effect } from 'effect';
import { getSignedInSession } from '../utils/login/get-signed-in-user';

export const authStatusCommand = Command.make('status', {}, () =>
  Effect.gen(function* () {
    const user = yield* getSignedInSession.pipe(
      Effect.catchTags({
        NoSignedInUserError: () => Effect.succeed(null)
      })
    );

    if (user) {
      yield* Console.log(`Logged in as ${user.name}`);
    } else {
      yield* Console.log('Not logged in');
    }
  })
).pipe(Command.withDescription('Check the status of the Voidhash CLI.'));
