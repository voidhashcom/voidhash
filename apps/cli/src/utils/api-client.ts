import {
  make as makeCoreClient,
  type VoidhashCoreClient,
} from "@voidhash/generated-clients";
import { Effect, Layer, ServiceMap } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/unstable/http";

import { CliConfig } from "../domain/services/cli-config";

const make = Effect.gen(function* effect() {
  yield* Effect.logDebug("Initializing API client");
  const cliConfig = yield* CliConfig;
  const httpClient = yield* HttpClient.HttpClient;
  return makeCoreClient(httpClient as VoidhashCoreClient["httpClient"], {
    transformClient: (client) =>
      Effect.succeed(
        client.pipe(
          HttpClient.mapRequestEffect((request) =>
            Effect.gen(function* transformClient() {
              const config = yield* cliConfig.readConfig().pipe(
                Effect.catch(() =>
                  Effect.die("Failed to read config")
                )
              );

              yield* Effect.logDebug(
                `API Request: ${request.method} ${request.url}`
              );

              return HttpClientRequest.setHeaders(
                HttpClientRequest.prependUrl(request, "http://localhost:5001"),
                config.api_key ? { "x-api-key": config.api_key } : {}
              );
            }).pipe(Effect.withSpan("ApiClient.transformRequest"))
          )
        )
      ),
  });
}).pipe(Effect.withSpan("ApiClient.make"));

type ApiClientShape = Effect.Success<typeof make>;

export class ApiClient extends ServiceMap.Service<ApiClient, ApiClientShape>()(
  "voidhash-cli/ApiClient"
) {
  static Default = Layer.effect(ApiClient, make).pipe(
    Layer.provide(Layer.mergeAll(FetchHttpClient.layer, CliConfig.Default))
  )
}
