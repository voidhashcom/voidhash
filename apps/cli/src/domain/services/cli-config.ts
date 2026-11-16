import { constant } from "@voidhash/lib/lang";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Schema from "effect/Schema";
import * as Context from "effect/Context";
import * as Option from "effect/Option";
import * as Config from "effect/Config";
import * as Crypto from "effect/Crypto";

import { CONFIG_FILE_NAME, DEFAULT_API_URL, DEFAULT_WEB_URL } from "../../constants";
import { getActiveProfile } from "../../utils/error-formatter";
import { FailedToReadCliConfigError } from "../errors/cli-config";
import {
  CliConfig as CliConfigDefinition,
  ResolvedCliConfig as ResolvedCliConfigDefinition,
} from "../schema/cli-config";

type ConfigFile = typeof CliConfigDefinition.Type;
type ResolvedConfig = typeof ResolvedCliConfigDefinition.Type;

export const emptyConfig = {
  api_url: DEFAULT_API_URL,
  web_url: DEFAULT_WEB_URL,
} satisfies ResolvedConfig;

/**
 * Strips the `profiles` map, the installation id and any legacy key from a
 * config file, leaving only the resolved base fields.
 */
const baseOf = ({
  profiles: _profiles,
  api_key: _apiKey,
  install_id: _installId,
  ...base
}: ConfigFile): ResolvedConfig => base;

/** A key from before the credential store, the API URL it was used with, and whose it is. */
export interface LegacyApiKey {
  readonly apiKey: string;
  readonly apiUrl: string;
  /** The profile that held it; none for the base config. */
  readonly profile: Option.Option<string>;
}

/**
 * The keys a config file still holds from before the credential store: the
 * base key first, then each profile's, with the API URL each was sent to.
 */
export const legacyApiKeys = (raw: ConfigFile): ReadonlyArray<LegacyApiKey> => [
  ...(raw.api_key ? [{ apiKey: raw.api_key, apiUrl: raw.api_url, profile: Option.none() }] : []),
  ...R.toEntries(raw.profiles ?? {}).flatMap(([name, profile]) =>
    profile.api_key
      ? [
          {
            apiKey: profile.api_key,
            apiUrl: profile.api_url ?? raw.api_url,
            profile: Option.some(name),
          },
        ]
      : [],
  ),
];

/** `raw` without the keys {@link legacyApiKeys} finds. */
const withoutApiKeys = ({ api_key: _apiKey, ...raw }: ConfigFile): ConfigFile => ({
  ...raw,
  ...(raw.profiles === undefined
    ? {}
    : { profiles: R.map(raw.profiles, ({ api_key: _key, ...profile }) => profile) }),
});

/** Raw JSON object shape of the config file, before schema decoding. */
const RawConfigJson = Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown));

/** Encodes a validated config file to the JSON text written to disk. */
const ConfigFileJson = Schema.fromJsonString(CliConfigDefinition);

const make = Effect.fn("make")(function* effect() {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const crypto = yield* Crypto.Crypto;

  const homeDir = yield* Config.String("HOME").pipe(Effect.orDie);
  const filePath = path.join(homeDir, CONFIG_FILE_NAME);

  // Resolved once at layer build time, mirroring the isDebugMode() pattern:
  // the --profile flag, then VOIDHASH_PROFILE.
  const profileVariable = yield* Config.option(Config.String("VOIDHASH_PROFILE")).pipe(
    Effect.orElseSucceed(() => Option.none<string>()),
  );
  const activeProfile = getActiveProfile().pipe(
    Option.orElse(() => Option.filter(profileVariable, (name) => name !== "")),
    Option.getOrElse(() => ""),
  );
  const apiUrlVariable = yield* Config.option(Config.String("VOIDHASH_API_URL")).pipe(
    Effect.orElseSucceed(() => Option.none<string>()),
  );

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

  const writeRawConfig = (config: ConfigFile) =>
    Effect.gen(function* () {
      const configJson = yield* Schema.encodeEffect(ConfigFileJson)(config);
      yield* fileSystem.writeFileString(filePath, configJson);
      yield* Effect.logDebug("Config file written successfully");
    });

  /**
   * Reads the effective configuration: the shared base config with the active
   * profile's overrides merged on top, and `VOIDHASH_API_URL` over both. When
   * no profile is active (or the requested profile has no overrides) this
   * equals the base config.
   *
   * @returns An Effect that yields the resolved configuration object.
   */
  const readConfig = () =>
    Effect.fn("readConfig")(function* readConfig() {
      const raw = yield* readRawConfig();
      const { api_key: _apiKey, ...overrides } = activeProfile
        ? (raw.profiles?.[activeProfile] ?? {})
        : {};
      const resolved: ResolvedConfig = { ...baseOf(raw), ...overrides };
      return Option.match(apiUrlVariable, {
        onNone: () => resolved,
        onSome: (api_url) => ({ ...resolved, api_url }),
      });
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
        Effect.catchTag("FailedToReadConfigError", () => Effect.succeed<ConfigFile>(emptyConfig)),
      );
      yield* writeRawConfig(mergeIntoConfig(currentConfig, config));
    })().pipe(Effect.withSpan("CliConfig.writeToConfig"));

  /**
   * Resets the configuration to the default values. When a profile is active,
   * only that profile's overrides are cleared, so it reverts to the base
   * config. Stored credentials are not touched.
   *
   * @returns An Effect that resets the configuration.
   */
  const resetConfig = () =>
    Effect.fn("resetConfig")(function* resetConfig() {
      yield* Effect.logDebug("Resetting config to defaults");

      if (activeProfile) {
        const raw = yield* readRawConfig();
        yield* writeRawConfig({ ...raw, profiles: { ...raw.profiles, [activeProfile]: {} } });
        yield* Effect.logDebug("Config reset complete");
        return;
      }

      yield* writeToConfig(emptyConfig);
      yield* Effect.logDebug("Config reset complete");
    })().pipe(Effect.withSpan("CliConfig.resetConfig"));

  /**
   * This installation's id, generated and saved in the base config the first
   * time it is needed.
   */
  const installId = () =>
    Effect.fn("installId")(function* installId() {
      const raw = yield* readRawConfig();
      if (raw.install_id) return raw.install_id;
      const id = yield* crypto.randomUUIDv4();
      yield* writeRawConfig({ ...raw, install_id: id });
      return id;
    })().pipe(Effect.withSpan("CliConfig.installId"));

  /** Removes the keys from before the credential store from the base config and every profile. */
  const removeLegacyApiKeys = () =>
    Effect.fn("removeLegacyApiKeys")(function* removeLegacyApiKeys() {
      yield* writeRawConfig(withoutApiKeys(yield* readRawConfig()));
    })().pipe(Effect.withSpan("CliConfig.removeLegacyApiKeys"));

  return constant({
    activeProfile,
    filePath,
    installId,
    readConfig,
    readRawConfig,
    removeLegacyApiKeys,
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
