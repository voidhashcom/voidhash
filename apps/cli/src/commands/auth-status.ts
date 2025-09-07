import { Command } from '@effect/cli';
import { Effect } from 'effect';

export const authStatusCommand = Command.make('status', {}, () =>
  Effect.gen(function* () {})
).pipe(Command.withDescription('Check the status of the Voidhash CLI.'));
