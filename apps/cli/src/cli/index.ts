import { Command } from '@effect/cli';
import { FetchHttpClient } from '@effect/platform';
import { NodeContext, NodeRuntime } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { Auth } from '../domain/services/auth';
import { CliConfig } from '../domain/services/cli-config';
import { Codegen } from '../domain/services/codegen';
import { SourceCode } from '../domain/services/source-code';
import { ApiClient } from '../utils/api-client';
import { authCommand } from './commands/auth';
import { configCommand } from './commands/config';
import { initCommand } from './commands/init';
import { schemaCommand } from './commands/schema';

const command = Command.make('voidhash').pipe(
  Command.withDescription('Voidhash CLI application.'),
  Command.withSubcommands([
    initCommand,
    authCommand,
    schemaCommand,
    configCommand
  ])
);

const cli = Command.run(command, {
  name: 'Voidhash CLI',
  version: '0.0.1-alpha.1'
});

const cliEffect = Effect.suspend(() => cli(process.argv));

const ServicesLayer = Layer.mergeAll(
  SourceCode.Default,
  Auth.Default,
  Codegen.Default
);

const PlatformLayer = Layer.mergeAll(NodeContext.layer, FetchHttpClient.layer);

const MainLayer = ServicesLayer.pipe(
  Layer.provideMerge(ApiClient.Default),
  Layer.provideMerge(CliConfig.Default),
  Layer.provideMerge(PlatformLayer)
);

NodeRuntime.runMain(cliEffect.pipe(Effect.provide(MainLayer)));

// cliEffect.pipe(
//   Effect.provide(MainLayer),
//   Effect.tapErrorCause(Effect.logError),

// );
