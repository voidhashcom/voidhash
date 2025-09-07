import { Command } from '@effect/cli';
import { Effect } from 'effect';

export const logoutCommand = Command.make('logout', {}, () =>
  Effect.gen(function* () {})
).pipe(Command.withDescription('Logout from the Voidhash CLI.'));
