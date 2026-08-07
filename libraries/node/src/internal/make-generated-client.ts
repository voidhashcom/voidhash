import { make as makeCoreClient } from "@voidhash/generated-clients";
import { Effect } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/unstable/http";

import { VoidhashNodeConfigurationError } from "../errors";
import { groupCoreClient, type GroupedVoidhashNodeEffectClient } from "../generated/grouped-client";
import type { VoidhashNodeClientOptions } from "../types";
export type GeneratedVoidhashNodeEffectClient = GroupedVoidhashNodeEffectClient;

export const DEFAULT_BASE_URL = "https://api.voidhash.com";

const SECRET_KEY_HEADER = "x-secret-key";

const hasSecretKeyHeader = (headers: Record<string, string | undefined> | undefined) =>
  Object.keys(headers ?? {}).some((headerName) => headerName.toLowerCase() === SECRET_KEY_HEADER);

const normalizeHeaders = (
  headers: Record<string, string | undefined> | undefined,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(headers ?? {}).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );

const resolveBaseUrl = (
  baseUrl: string | undefined,
): Effect.Effect<string, VoidhashNodeConfigurationError> =>
  Effect.gen(function* () {
    const resolved = yield* Effect.try({
      try: () => new URL(baseUrl ?? DEFAULT_BASE_URL),
      catch: (cause) =>
        new VoidhashNodeConfigurationError("baseUrl must be a valid URL.", {
          cause,
        }),
    });

    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      return yield* Effect.fail(
        new VoidhashNodeConfigurationError("baseUrl must use the http or https protocol."),
      );
    }

    return resolved.toString();
  });

const resolveOptions = (options: VoidhashNodeClientOptions) =>
  Effect.gen(function* () {
    if (!options.secretKey.trim()) {
      return yield* Effect.fail(new VoidhashNodeConfigurationError("secretKey is required."));
    }

    if (typeof globalThis.fetch !== "function") {
      return yield* Effect.fail(
        new VoidhashNodeConfigurationError("globalThis.fetch must be available."),
      );
    }

    if (hasSecretKeyHeader(options.headers)) {
      return yield* Effect.fail(
        new VoidhashNodeConfigurationError("headers.x-secret-key cannot be set explicitly."),
      );
    }

    return {
      baseUrl: yield* resolveBaseUrl(options.baseUrl),
      headers: normalizeHeaders(options.headers),
      secretKey: options.secretKey,
    };
  });

export const makeGeneratedClient = (
  options: VoidhashNodeClientOptions,
): Effect.Effect<GeneratedVoidhashNodeEffectClient, VoidhashNodeConfigurationError> =>
  Effect.gen(function* () {
    const resolvedOptions = yield* resolveOptions(options);
    const httpClient = yield* HttpClient.HttpClient;
    const client = makeCoreClient(httpClient, {
      transformClient: (httpClient) =>
        Effect.succeed(
          httpClient.pipe(
            HttpClient.mapRequest((request) =>
              HttpClientRequest.setHeader(
                HttpClientRequest.setHeaders(
                  HttpClientRequest.prependUrl(request, resolvedOptions.baseUrl),
                  resolvedOptions.headers,
                ),
                SECRET_KEY_HEADER,
                resolvedOptions.secretKey,
              ),
            ),
          ),
        ),
    });

    return groupCoreClient(client);
  }).pipe(Effect.provide(FetchHttpClient.layer));
