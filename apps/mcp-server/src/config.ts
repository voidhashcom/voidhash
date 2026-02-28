import { Effect, Schema } from "effect";
import os from "node:os";
import path from "node:path";
import { readFile } from "node:fs/promises";

import { AppError } from "./errors";

const CliConfigSchema = Schema.Struct({
  api_key: Schema.NullishOr(Schema.String),
  api_url: Schema.String,
  web_url: Schema.optional(Schema.String),
});

export interface VoidhashMcpConfig {
  apiKey: string;
  apiOrigin: string;
  apiUrl: string;
  configPath: string;
  wsBaseUrl: string;
}

export interface LoadConfigOptions {
  configPath?: string;
}

const getDefaultConfigPath = (): string => path.join(os.homedir(), ".voidhash");

export const loadConfig = async (
  options: LoadConfigOptions = {},
): Promise<VoidhashMcpConfig> => {
  const configPath = options.configPath ?? getDefaultConfigPath();

  let rawConfig = "";
  try {
    rawConfig = await readFile(configPath, "utf8");
  } catch (error) {
    throw new AppError(
      "CONFIG_ERROR",
      `Failed to read Voidhash CLI config at ${configPath}`,
      {
        cause: error,
        hint: "Run `voidhash-cli auth login` first.",
      },
    );
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawConfig);
  } catch (error) {
    throw new AppError(
      "CONFIG_ERROR",
      `Voidhash CLI config at ${configPath} is not valid JSON`,
      { cause: error },
    );
  }

  let decodedConfig: typeof CliConfigSchema.Type;
  try {
    decodedConfig = Effect.runSync(Schema.decodeUnknown(CliConfigSchema)(parsedJson));
  } catch (error) {
    throw new AppError("CONFIG_ERROR", "Voidhash CLI config shape is invalid", {
      cause: error,
      configPath,
    });
  }

  if (!decodedConfig.api_key || decodedConfig.api_key.trim().length === 0) {
    throw new AppError("AUTH_ERROR", "Missing api_key in ~/.voidhash", {
      configPath,
      hint: "Run `voidhash-cli auth login` to populate api_key.",
    });
  }

  let apiOrigin: string;
  let wsBaseUrl: string;
  try {
    const apiUrl = new URL(decodedConfig.api_url);
    apiOrigin = apiUrl.origin;

    const wsUrl = new URL("/mimic/paywall-designer", apiOrigin);
    wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";
    wsBaseUrl = wsUrl.toString();
  } catch (error) {
    throw new AppError("CONFIG_ERROR", "api_url in ~/.voidhash is not a valid URL", {
      api_url: decodedConfig.api_url,
      cause: error,
    });
  }

  return {
    apiKey: decodedConfig.api_key,
    apiOrigin,
    apiUrl: decodedConfig.api_url,
    configPath,
    wsBaseUrl,
  };
};
