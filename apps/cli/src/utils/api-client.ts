import { make as makeCoreClient } from "@voidhash/generated-clients";
import { Effect, Layer, Context } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/unstable/http";

import { CliConfig } from "../domain/services/cli-config";

/** Builds the API key header set, empty when no key is configured. */
const apiKeyHeaders = (apiKey: string | null | undefined): Record<string, string> => {
  if (apiKey) return { "x-api-key": apiKey };
  return {};
};

const make = Effect.gen(function* effect() {
  yield* Effect.logDebug("Initializing API client");
  const cliConfig = yield* CliConfig;
  const httpClient = yield* HttpClient.HttpClient;
  return makeCoreClient(httpClient, {
    transformClient: (client) =>
      Effect.succeed(
        client.pipe(
          HttpClient.mapRequestEffect((request) =>
            Effect.gen(function* transformClient() {
              const config = yield* cliConfig
                .readConfig()
                .pipe(Effect.catch(() => Effect.die("Failed to read config")));

              yield* Effect.logDebug(`API Request: ${request.method} ${request.url}`);

              return HttpClientRequest.setHeaders(
                HttpClientRequest.prependUrl(request, config.api_url),
                apiKeyHeaders(config.api_key),
              );
            }).pipe(Effect.withSpan("ApiClient.transformRequest")),
          ),
        ),
      ),
  });
}).pipe(Effect.withSpan("ApiClient.make"));

type ApiClientShape = Effect.Success<typeof make>;

export class ApiClient extends Context.Service<ApiClient, ApiClientShape>()(
  "voidhash-cli/ApiClient",
) {
  static Default = Layer.effect(ApiClient, make).pipe(
    Layer.provide(Layer.mergeAll(FetchHttpClient.layer, CliConfig.Default)),
  );
}
