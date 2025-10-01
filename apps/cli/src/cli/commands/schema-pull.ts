import { Command } from '@effect/cli';
import { Effect } from 'effect';

export const schemaPullCommand = Command.make('pull', {}, () =>
  Effect.gen(function* () {})
).pipe(Command.withDescription('Pull the Voidhash schema from the database.'));
