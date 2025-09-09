import os from 'node:os';
import path from 'node:path';
import { FileSystem } from '@effect/platform';
import { Effect, type Schema } from 'effect';
import { CONFIG_FILE_NAME } from '../../constants';
import { readConfig } from './read-config';
import type { ConfigSchema } from './schema';

/**
 * Writes the provided partial configuration to the user's config file.
 * Merges the new config with any existing config, then saves the result.
 *
 * @param config - Partial configuration object to write to the config file.
 * @returns An Effect that writes the merged configuration to disk.
 */
export const writeToConfig = (
  config: Partial<Schema.Schema.Type<typeof ConfigSchema>>
) =>
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const homeDir = os.homedir();
    const filePath = path.join(homeDir, CONFIG_FILE_NAME);
    const currentConfig = yield* readConfig().pipe(
      Effect.orElse(() => Effect.succeed({}))
    );
    yield* fileSystem.writeFileString(
      filePath,
      JSON.stringify({ ...currentConfig, ...config })
    );
  });
