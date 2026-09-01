import { constant } from "@voidhash/lib/lang";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import * as Context from "effect/Context";
import * as Option from "effect/Option";
import * as Config from "effect/Config";

import { CONFIG_FILE_NAME, DEFAULT_API_URL, DEFAULT_WEB_URL } from "../../constants";
import { getActiveProfile } from "../../utils/error-formatter";
import { FailedToReadCliConfigError } from "../errors/cli-config";
import {
  CliConfig as CliConfigDefinition,
  CliProfile as CliProfileDefinition,
  ResolvedCliConfig as ResolvedCliConfigDefinition,
} from "../schema/cli-config";

type ConfigFile = typeof CliConfigDefinition.Type;
type ResolvedConfig = typeof ResolvedCliConfigDefinition.Type;
type ProfileOverrides = typeof CliProfileDefinition.Type;

export const emptyConfig = {
  api_key: null,
  api_url: DEFAULT_API_URL,
  web_url: DEFAULT_WEB_URL,
} satisfies ResolvedConfig;

/**
 * Strips the `profiles` map from a config file, leaving only the resolved base
 * fields (`api_key`, `api_url`, `web_url`).
 */
const baseOf = (config: ConfigFile): ResolvedConfig => ({
  api_key: config.api_key,
  api_url: config.api_url,
  web_url: config.web_url,
});

/**
 * Builds the profile overrides to keep when resetting a profile. Never persists
 * `api_key: null` as an override — that would mask the base key.
 */
const preservedOverrides = (apiKey: Option.Option<string>): ProfileOverrides =>
  Option.match(apiKey, { onNone: () => ({}), onSome: (api_key) => ({ api_key }) });

/** Raw JSON object shape of the config file, before schema decoding. */
const RawConfigJson = Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown));

/** Encodes a validated config file to the JSON text written to disk. */
const ConfigFileJson = Schema.fromJsonString(CliConfigDefinition);

const make = Effect.fn("make")(function* effect() {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const homeDir = yield* Config.string("HOME").pipe(Effect.orDie);
  const filePath = path.join(homeDir, CONFIG_FILE_NAME);

  // Resolved once at layer build time, mirroring the isDebugMode() pattern.
  const activeProfile = Option.getOrElse(getActiveProfile(), () => "");

  /**
   * Reads and decodes the raw config file, including the full `profiles` map.
   * Returns the defaults when the file does not exist.
   *
   * @returns An Effect that yields the parsed config file, or fails with a
   * FailedToReadCliConfigError if the file cannot be read or is invalid.
   */
  const readRawConfig = () =>
    Effect.fn("readRawConfig")(function* readRawConfig() {
      yield* Effect.logDebug(`Reading config from ${filePath}`);
      const exists = yield* fileSystem.exists(filePath);
      if (!exists) {
        yield* Effect.logDebug("Config file not found, using defaults");
        return yield* Effect.succeed<ConfigFile>(emptyConfig);
      }
      const configString = yield* fileSystem.readFileString(filePath);
      const configJson = yield* Schema.decodeUnknownEffect(RawConfigJson)(configString);
      yield* Effect.logDebug("Config file loaded successfully");
      return yield* Schema.decodeUnknownEffect(CliConfigDefinition)({
        ...emptyConfig,
        ...configJson,
      });
    })().pipe(
      Effect.withSpan("CliConfig.readRawConfig"),
      Effect.catchTags({
        PlatformError: (e) =>
          Effect.fail(
            new FailedToReadCliConfigError({
              cause: e,
              message: "Failed to read config",
            }),
          ),
        SchemaError: (e) =>
          Effect.fail(
            new FailedToReadCliConfigError({
              cause: e,
              message: "Failed to read config",
            }),
          ),
      }),
    );

  /**
   * Reads the effective configuration: the shared base config with the active
   * profile's overrides merged on top. When no profile is active (or the
   * requested profile has no overrides) this equals the base config.
   *
   * @returns An Effect that yields the resolved configuration object.
   */
  const readConfig = () =>
    Effect.fn("readConfig")(function* readConfig() {
      const raw = yield* readRawConfig();
      const base = baseOf(raw);
      if (!activeProfile) return base;
      const overrides = raw.profiles?.[activeProfile] ?? {};
      return { ...base, ...overrides } satisfies ResolvedConfig;
    })().pipe(Effect.withSpan("CliConfig.readConfig"));

  /**
   * Writes the provided partial configuration. When a profile is active the
   * values are merged into that profile's overrides, leaving the base config and
   * other profiles untouched; otherwise they are merged into the base config.
   *
   * @param config - Partial configuration values to persist.
   * @returns An Effect that writes the merged configuration to disk.
   */
  const mergeIntoConfig = (
    currentConfig: ConfigFile,
    config: Partial<ResolvedConfig>,
  ): ConfigFile => {
    if (!activeProfile) return { ...currentConfig, ...config };
    return {
      ...currentConfig,
      profiles: {
        ...currentConfig.profiles,
        [activeProfile]: {
          ...currentConfig.profiles?.[activeProfile],
          ...config,
        },
      },
    };
  };

  const writeToConfig = (config: Partial<ResolvedConfig>) =>
    Effect.fn("writeToConfig")(function* writeToConfig() {
      yield* Effect.logDebug(`Writing config to ${filePath}`);
      const currentConfig = yield* readRawConfig().pipe(
        Effect.catchTag("FailedToReadConfigError", () =>
          Effect.succeed<ConfigFile>(emptyConfig),
        ),
      );

      const mergedConfig = mergeIntoConfig(currentConfig, config);

      const configJson = yield* Schema.encodeEffect(ConfigFileJson)(mergedConfig);
      yield* fileSystem.writeFileString(filePath, configJson);
      yield* Effect.logDebug("Config file written successfully");
    })().pipe(Effect.withSpan("CliConfig.writeToConfig"));

  /**
   * Resets the configuration to the default values. If authenticated, persists
   * the authentication state. When a profile is active, only that profile's
   * overrides are cleared (so it reverts to the base config), preserving a
   * non-null api_key override if present.
   *
   * @returns An Effect that resets the configuration.
   */
  const resetConfig = () =>
    Effect.fn("resetConfig")(function* resetConfig() {
      yield* Effect.logDebug("Resetting config to defaults");

      if (activeProfile) {
        const raw = yield* readRawConfig();
        const preserved = preservedOverrides(
          Option.fromNullishOr(raw.profiles?.[activeProfile]?.api_key),
        );
        const mergedConfig: ConfigFile = {
          ...baseOf(raw),
          profiles: { ...raw.profiles, [activeProfile]: preserved },
        };
        const configJson = yield* Schema.encodeEffect(ConfigFileJson)(mergedConfig);
        yield* fileSystem.writeFileString(filePath, configJson);
        yield* Effect.logDebug("Config reset complete");
        return;
      }

      const config = yield* readConfig();
      yield* writeToConfig({
        ...emptyConfig,
        api_key: config.api_key ?? null,
      });
      yield* Effect.logDebug("Config reset complete");
    })().pipe(Effect.withSpan("CliConfig.resetConfig"));

  return constant({
    readConfig,
    readRawConfig,
    resetConfig,
    writeToConfig,
  });
})();

type CliConfigShape = Effect.Success<typeof make>;

export class CliConfig extends Context.Service<CliConfig, CliConfigShape>()(
  "voidhash-cli/CliConfig",
) {
  static Default = Layer.effect(CliConfig, make);
}
