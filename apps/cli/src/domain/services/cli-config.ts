import { FileSystem, Path } from "@effect/platform";
import { Effect, Schema } from "effect";
import os from "node:os";

import {
  CONFIG_FILE_NAME,
  DEFAULT_API_URL,
  DEFAULT_WEB_URL,
} from "../../constants";
import { FailedToReadCliConfigError } from "../errors/cli-config";
import { CliConfigSchema } from "../schema/cli-config";

export const emptyConfig = {
  api_key: null,
  api_url: DEFAULT_API_URL,
  web_url: DEFAULT_WEB_URL,
} satisfies typeof CliConfigSchema.Type;

export class CliConfig extends Effect.Service<CliConfig>()(
  "voidhash-cli/CliConfig",
  {
    dependencies: [],
    // Define how to create the service
    effect: Effect.gen(function* effect() {
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
        Effect.gen(function* readConfig() {
          yield* Effect.logDebug(`Reading config from ${filePath}`);
          if (!fileSystem.exists(filePath)) {
            yield* Effect.logDebug("Config file not found, using defaults");
            return yield* Effect.succeed(emptyConfig);
          }
          const configString = yield* fileSystem.readFileString(filePath);
          const configJson = JSON.parse(configString);
          yield* Effect.logDebug("Config file loaded successfully");
          return yield* Schema.decodeUnknown(CliConfigSchema)({
            ...emptyConfig,
            ...configJson,
          });
        }).pipe(
          Effect.withSpan("CliConfig.readConfig"),
          Effect.catchTags({
            BadArgument: (e) =>
              Effect.fail(
                new FailedToReadCliConfigError({
                  cause: e,
                  message: "Failed to read config",
                })
              ),
            ParseError: (e) =>
              Effect.fail(
                new FailedToReadCliConfigError({
                  cause: e,
                  message: "Failed to read config",
                })
              ),
            SystemError: (e) =>
              Effect.fail(
                new FailedToReadCliConfigError({
                  cause: e,
                  message: "Failed to read config",
                })
              ),
          })
        );

      /**
       * Writes the provided partial configuration to the user's config file.
       * Merges the new config with any existing config, then saves the result.
       *
       * @param config - Partial configuration object to write to the config file.
       * @returns An Effect that writes the merged configuration to disk.
       */
      const writeToConfig = (config: Partial<typeof CliConfigSchema.Type>) =>
        Effect.gen(function* writeToConfig() {
          yield* Effect.logDebug(`Writing config to ${filePath}`);
          const currentConfig = yield* readConfig().pipe(
            Effect.orElse(() => Effect.succeed({}))
          );
          const mergedConfig = { ...currentConfig, ...config };
          const validatedConfig =
            yield* Schema.decodeUnknown(CliConfigSchema)(mergedConfig);
          yield* fileSystem.writeFileString(
            filePath,
            JSON.stringify(validatedConfig)
          );
          yield* Effect.logDebug("Config file written successfully");
        }).pipe(Effect.withSpan("CliConfig.writeToConfig"));

      /**
       * Resets the configuration to the default values. If authenticated, persists the authentication state.
       *
       * @returns An Effect that resets the configuration to the default values.
       */
      const resetConfig = () =>
        Effect.gen(function* resetConfig() {
          yield* Effect.logDebug("Resetting config to defaults");
          const config = yield* readConfig();

          yield* writeToConfig({
            ...emptyConfig,
            api_key: config.api_key ?? null,
          });
          yield* Effect.logDebug("Config reset complete");
        }).pipe(Effect.withSpan("CliConfig.resetConfig"));

      return {
        readConfig,
        resetConfig,
        writeToConfig,
      } as const;
    }),
  }
) {}
