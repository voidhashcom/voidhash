import { Command } from '@effect/cli';
import { Effect } from 'effect';

export const initCommand = Command.make('init', {}, () =>
  Effect.gen(function* () {})
).pipe(Command.withDescription('Initialize a new Voidhash project.'));
