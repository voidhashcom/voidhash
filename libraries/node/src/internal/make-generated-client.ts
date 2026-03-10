import { VoidhashV1Api } from "@voidhash/api-spec";
import { Effect } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
} from "effect/unstable/http";
import { HttpApiClient } from "effect/unstable/httpapi";

import { VoidhashNodeConfigurationError } from "../errors";
import type { VoidhashNodeClientOptions } from "../types";
import type { GeneratedVoidhashNodeEffectClient } from "./client-types";
import { toJsonCompatibleApi } from "./json-compatible-api";

export const DEFAULT_BASE_URL = "https://api.voidhash.com";

const SECRET_KEY_HEADER = "x-secret-key";

const hasSecretKeyHeader = (
  headers: Record<string, string | undefined> | undefined
) =>
  Object.keys(headers ?? {}).some(
    (headerName) => headerName.toLowerCase() === SECRET_KEY_HEADER
  );

const normalizeHeaders = (
  headers: Record<string, string | undefined> | undefined
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(headers ?? {}).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string"
    )
  );

const resolveBaseUrl = (baseUrl: string | undefined) => {
  try {
    const resolved = new URL(baseUrl ?? DEFAULT_BASE_URL);

    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      throw new VoidhashNodeConfigurationError(
        "baseUrl must use the http or https protocol."
      );
    }

    return resolved.toString();
  } catch (error) {
    if (error instanceof VoidhashNodeConfigurationError) {
      throw error;
    }

    throw new VoidhashNodeConfigurationError("baseUrl must be a valid URL.", {
      cause: error,
    });
  }
};

const resolveOptions = (options: VoidhashNodeClientOptions) => {
  if (!options.secretKey.trim()) {
    throw new VoidhashNodeConfigurationError("secretKey is required.");
  }

  if (typeof globalThis.fetch !== "function") {
    throw new VoidhashNodeConfigurationError(
      "globalThis.fetch must be available."
    );
  }

  if (hasSecretKeyHeader(options.headers)) {
    throw new VoidhashNodeConfigurationError(
      "headers.x-secret-key cannot be set explicitly."
    );
  }

  return {
    baseUrl: resolveBaseUrl(options.baseUrl),
    headers: normalizeHeaders(options.headers),
    secretKey: options.secretKey,
  };
};

const JsonVoidhashV1Api = toJsonCompatibleApi(VoidhashV1Api);

export const makeGeneratedClient = (
  options: VoidhashNodeClientOptions
): Effect.Effect<GeneratedVoidhashNodeEffectClient> => {
  const resolvedOptions = resolveOptions(options);

  return HttpApiClient.make(JsonVoidhashV1Api, {
    baseUrl: resolvedOptions.baseUrl,
    transformClient: (client) =>
      client.pipe(
        HttpClient.mapRequest((request) =>
          HttpClientRequest.setHeader(
            HttpClientRequest.setHeaders(request, resolvedOptions.headers),
            SECRET_KEY_HEADER,
            resolvedOptions.secretKey
          )
        )
      ),
  }).pipe(Effect.provide(FetchHttpClient.layer));
};
