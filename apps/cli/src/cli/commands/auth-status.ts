import { Command } from '@effect/cli';
import { Console, Effect } from 'effect';
import { Auth } from '../../domain/services/auth';

export const authStatusCommand = Command.make('status', {}, () =>
  Effect.gen(function* () {
    const auth = yield* Auth;
    const user = yield* auth.getSignedInSession.pipe(
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
