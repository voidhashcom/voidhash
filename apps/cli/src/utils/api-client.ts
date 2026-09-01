import { make as makeCoreClient } from "@voidhash/generated-clients";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/unstable/http";
import * as Option from "effect/Option";

import { CliConfig } from "../domain/services/cli-config";

/** Builds the API key header set, empty when no key is configured. */
const apiKeyHeaders = (apiKey: Option.Option<string>): Record<string, string> =>
  Option.match(apiKey, {
    onNone: () => ({}),
    onSome: (value) => ({ "x-api-key": value }),
  });

const make = Effect.gen(function* effect() {
  yield* Effect.logDebug("Initializing API client");
  const cliConfig = yield* CliConfig;
  const httpClient = yield* HttpClient.HttpClient;
  return makeCoreClient(httpClient, {
    transformClient: (client) =>
      Effect.succeed(
        client.pipe(
          HttpClient.mapRequestEffect((request) =>
            Effect.fn("transformClient")(function* transformClient() {
              const config = yield* cliConfig
                .readConfig()
                .pipe(Effect.catch(() => Effect.die("Failed to read config")));

              yield* Effect.logDebug(`API Request: ${request.method} ${request.url}`);

              return HttpClientRequest.setHeaders(
                HttpClientRequest.prependUrl(request, config.api_url),
                apiKeyHeaders(Option.fromNullishOr(config.api_key)),
              );
            })().pipe(Effect.withSpan("ApiClient.transformRequest")),
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
