import * as R from "effect/Record";
import * as P from "effect/Predicate";
import { make as makeCoreClient } from "@voidhash/generated-clients";
import {
  make as makeIngestClient,
  type VoidhashEventCaptureClient,
} from "@voidhash/generated-clients/event-capture";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/unstable/http";

import { VoidhashNodeConfigurationError } from "../errors";
import { groupCoreClient, type GroupedVoidhashNodeEffectClient } from "../generated/grouped-client";
import type { VoidhashNodeClientOptions } from "../types";
export type GeneratedVoidhashNodeEffectClient = GroupedVoidhashNodeEffectClient;

/** The generated clients the public namespaces are layered on top of. */
export type GeneratedVoidhashNodeClients = {
  readonly core: GeneratedVoidhashNodeEffectClient;
  readonly eventCapture: VoidhashEventCaptureClient;
};

export const DEFAULT_BASE_URL = "https://api.voidhash.com";

export const DEFAULT_INGEST_URL = "https://ingest.voidhash.com";

const SECRET_KEY_HEADER = "x-secret-key";

const hasSecretKeyHeader = (headers?: Record<string, string>) =>
  R.keys(headers ?? {}).some((headerName) => headerName.toLowerCase() === SECRET_KEY_HEADER);

const normalizeHeaders = (headers?: Record<string, string>): Record<string, string> =>
  headers ?? {};

const resolveUrl = (
  optionName: string,
  url: Option.Option<string>,
  fallback: string,
): Effect.Effect<string, VoidhashNodeConfigurationError> =>
  Effect.gen(function* () {
    const resolved = yield* Effect.try({
      try: () => new URL(Option.getOrElse(url, () => fallback)),
      catch: (cause) =>
        new VoidhashNodeConfigurationError(`${optionName} must be a valid URL.`, {
          cause,
        }),
    });

    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      return yield* Effect.fail(
        new VoidhashNodeConfigurationError(`${optionName} must use the http or https protocol.`),
      );
    }

    return resolved.toString();
  });

const resolveOptions = (options: VoidhashNodeClientOptions) =>
  Effect.gen(function* () {
    if (!options.secretKey.trim()) {
      return yield* Effect.fail(new VoidhashNodeConfigurationError("secretKey is required."));
    }

    if (!P.isFunction(globalThis.fetch)) {
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
      baseUrl: yield* resolveUrl(
        "baseUrl",
        Option.fromNullishOr(options.baseUrl),
        DEFAULT_BASE_URL,
      ),
      headers: normalizeHeaders(options.headers),
      ingestUrl: yield* resolveUrl(
        "ingestUrl",
        Option.fromNullishOr(options.ingestUrl),
        DEFAULT_INGEST_URL,
      ),
      secretKey: options.secretKey,
    };
  });

export const makeGeneratedClients = (
  options: VoidhashNodeClientOptions,
): Effect.Effect<GeneratedVoidhashNodeClients, VoidhashNodeConfigurationError> =>
  Effect.gen(function* () {
    const resolvedOptions = yield* resolveOptions(options);
    const httpClient = yield* HttpClient.HttpClient;
    const transformClient = (baseUrl: string) => (httpClient: HttpClient.HttpClient) =>
      Effect.succeed(
        httpClient.pipe(
          HttpClient.mapRequest((request) =>
            HttpClientRequest.setHeader(
              HttpClientRequest.setHeaders(
                HttpClientRequest.prependUrl(request, baseUrl),
                resolvedOptions.headers,
              ),
              SECRET_KEY_HEADER,
              resolvedOptions.secretKey,
            ),
          ),
        ),
      );

    return {
      core: groupCoreClient(
        makeCoreClient(httpClient, {
          transformClient: transformClient(resolvedOptions.baseUrl),
        }),
      ),
      eventCapture: makeIngestClient(httpClient, {
        transformClient: transformClient(resolvedOptions.ingestUrl),
      }),
    };
  }).pipe(Effect.provide(FetchHttpClient.layer));
