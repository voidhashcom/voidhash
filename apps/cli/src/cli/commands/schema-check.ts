import { Command } from '@effect/cli';
import { Effect } from 'effect';

export const schemaCheckCommand = Command.make('check', {}, () =>
  Effect.gen(function* () {})
).pipe(Command.withDescription('Check the Voidhash schema.'));
