import { Command } from '@effect/cli';
import { BunContext, BunRuntime } from '@effect/platform-bun';
import { Effect, Layer } from 'effect';
import { authCommand } from './commands/auth';
import { initCommand } from './commands/init';
import { schemaCommand } from './commands/schema';

const MainLayer = Layer.mergeAll(BunContext.layer);

const command = Command.make('voidhash').pipe(
  Command.withDescription('Voidhash CLI application.'),
  Command.withSubcommands([initCommand, authCommand, schemaCommand])
);

const cli = Command.run(command, {
  name: 'Voidhash CLI',
  version: '0.0.1-alpha.1'
});

Effect.suspend(() => cli(process.argv)).pipe(
  Effect.provide(MainLayer),
  Effect.tapErrorCause(Effect.logError),
  BunRuntime.runMain
);
