import { VoidhashV1Api } from "@voidhash/api-spec";
import { Effect, Layer, ServiceMap } from "effect";
import { FetchHttpClient, HttpClient } from "effect/unstable/http";
import { HttpApiClient } from "effect/unstable/httpapi";

import { CliConfig } from "../domain/services/cli-config";

const make = Effect.gen(function* effect() {
  yield* Effect.logDebug("Initializing API client");
  const cliConfig = yield* CliConfig;
  return yield* HttpApiClient.make(VoidhashV1Api, {
    baseUrl: "http://localhost:5001",
    transformClient: (client) =>
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

            return {
              ...request,
              headers: {
                ...request.headers,
                ...(config.api_key ? { "x-api-key": config.api_key } : {}),
              },
            };
          }).pipe(Effect.withSpan("ApiClient.transformRequest"))
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
