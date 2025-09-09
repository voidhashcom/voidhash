import { Command } from '@effect/cli';
import { FetchHttpClient } from '@effect/platform';
import { NodeContext, NodeRuntime } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { authCommand } from './commands/auth';
import { initCommand } from './commands/init';
import { schemaCommand } from './commands/schema';

const command = Command.make('voidhash').pipe(
  Command.withDescription('Voidhash CLI application.'),
  Command.withSubcommands([initCommand, authCommand, schemaCommand])
);

const cli = Command.run(command, {
  name: 'Voidhash CLI',
  version: '0.0.1-alpha.1'
});

const cliEffect = Effect.suspend(() => cli(process.argv));

const MainLayer = Layer.mergeAll(FetchHttpClient.layer, NodeContext.layer);

cliEffect.pipe(
  Effect.provide(MainLayer),
  Effect.tapErrorCause(Effect.logError),
  NodeRuntime.runMain
);
