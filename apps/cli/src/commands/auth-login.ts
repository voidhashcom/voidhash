import { Command } from '@effect/cli';
import { Effect } from 'effect';

export const loginCommand = Command.make('login', {}, () =>
  Effect.gen(function* () {})
).pipe(Command.withDescription('Login to the Voidhash CLI.'));
