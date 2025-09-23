import { Command } from '@effect/cli';
import { FetchHttpClient } from '@effect/platform';
import { NodeContext, NodeRuntime } from '@effect/platform-node';
import { Effect } from 'effect';
import { BetterAuthClient } from './better-auth';
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

cliEffect.pipe(
  Effect.tapErrorCause(Effect.logError),
  Effect.provide(FetchHttpClient.layer),
  Effect.provide(BetterAuthClient.Default),
  Effect.provide(NodeContext.layer),
  NodeRuntime.runMain
);
