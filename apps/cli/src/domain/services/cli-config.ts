import os from 'node:os';
import { FileSystem, Path } from '@effect/platform';
import { Effect, Schema } from 'effect';
import { CONFIG_FILE_NAME } from '../../constants';
import {
  CliConfigFileNotFoundError,
  FailedToReadCliConfigError
} from '../errors/cli-config';
import { CliConfigSchema } from '../schema/cli-config';

export class CliConfig extends Effect.Service<CliConfig>()(
  'voidhash-cli/CliConfig',
  {
    dependencies: [],
    // Define how to create the service
    effect: Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;

      const homeDir = os.homedir();
      const filePath = path.join(homeDir, CONFIG_FILE_NAME);

      /**
       * Reads and decodes the user's configuration file from the home directory.
       *
       * @returns An Effect that yields the parsed configuration object, or fails with a ConfigFileNotFoundError if the config file does not exist, or a Schema.DecodeError if the file contents are invalid.
       */
      const readConfig = () =>
        Effect.gen(function* () {
          if (!fileSystem.exists(filePath)) {
            return yield* Effect.fail(
              new CliConfigFileNotFoundError({
                message: 'Config file not found'
              })
            );
          }
          const configString = yield* fileSystem.readFileString(filePath);
          const configJson = JSON.parse(configString);
          return yield* Schema.decodeUnknown(CliConfigSchema)(configJson);
        }).pipe(
          Effect.catchTags({
            BadArgument: (e) =>
              Effect.fail(
                new FailedToReadCliConfigError({
                  message: 'Failed to read config',
                  cause: e
                })
              ),
            SystemError: (e) =>
              Effect.fail(
                new FailedToReadCliConfigError({
                  message: 'Failed to read config',
                  cause: e
                })
              ),
            ParseError: (e) =>
              Effect.fail(
                new FailedToReadCliConfigError({
                  message: 'Failed to read config',
                  cause: e
                })
              )
          })
        );

      /**
       * Writes the provided partial configuration to the user's config file.
       * Merges the new config with any existing config, then saves the result.
       *
       * @param config - Partial configuration object to write to the config file.
       * @returns An Effect that writes the merged configuration to disk.
       */
      const writeToConfig = (
        config: Partial<Schema.Schema.Type<typeof CliConfigSchema>>
      ) =>
        Effect.gen(function* () {
          const currentConfig = yield* readConfig().pipe(
            Effect.orElse(() => Effect.succeed({}))
          );
          yield* fileSystem.writeFileString(
            filePath,
            JSON.stringify({ ...currentConfig, ...config })
          );
        });

      return {
        readConfig,
        writeToConfig
      } as const;
    })
  }
) {}
