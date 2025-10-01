import { Command } from '@effect/cli';
import { Effect } from 'effect';

export const schemaPushCommand = Command.make('push', {}, () =>
  Effect.gen(function* () {})
).pipe(Command.withDescription('Push the Voidhash schema to the database.'));
