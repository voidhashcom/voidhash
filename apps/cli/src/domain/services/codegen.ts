import { FileSystem } from '@effect/platform';
import { Effect } from 'effect';
import type { Writable } from '../../utils/types';
import type { VoidhashConfigSchema } from '../schema/voidhash-config';

export class Codegen extends Effect.Service<Codegen>()('voidhash-cli/Codegen', {
  dependencies: [],
  // Define how to create the service
  effect: Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;

    const generateVoidhashConfigFile = (
      path: string,
      config: Writable<typeof VoidhashConfigSchema.Type>
    ) =>
      Effect.gen(function* () {
        const content = `import { defineConfig } from 'voidhash-cli';

export default defineConfig({
  team: '${config.team}',
  project: '${config.project}',
  schema: '${config.schema}'
});
`;
        yield* fileSystem.writeFileString(path, content);
      });

    const generateClientFile = (path: string) => Effect.gen(function* () {});

    const generateSchemaFile = (path: string) => Effect.gen(function* () {});

    return {
      generateVoidhashConfigFile,
      generateClientFile,
      generateSchemaFile
    } as const;
  })
}) {}
