import os from 'node:os';
import path from 'node:path';
import { FileSystem } from '@effect/platform';
import { Data, Effect, Schema } from 'effect';
import { CONFIG_FILE_NAME } from '../../constants';
import { ConfigSchema } from './schema';

export class ConfigFileNotFoundError extends Data.TaggedError(
  'ConfigFileNotFoundError'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

/**
 * Reads and decodes the user's configuration file from the home directory.
 *
 * @returns An Effect that yields the parsed configuration object, or fails with a ConfigFileNotFoundError if the config file does not exist, or a Schema.DecodeError if the file contents are invalid.
 */
export const readConfig = () =>
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const homeDir = os.homedir();
    const filePath = path.join(homeDir, CONFIG_FILE_NAME);
    if (!fileSystem.exists(filePath)) {
      return yield* Effect.fail(
        new ConfigFileNotFoundError({ message: 'Config file not found' })
      );
    }
    const configString = yield* fileSystem.readFileString(filePath);
    const configJson = JSON.parse(configString);
    return yield* Schema.decodeUnknown(ConfigSchema)(configJson);
  });
