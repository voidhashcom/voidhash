import { FetchHttpClient, HttpApiClient, HttpClient } from "@effect/platform";
import { VoidhashV1Api } from "@voidhash/api-spec";
import { Effect } from "effect";

import { CliConfig } from "../domain/services/cli-config";

export class ApiClient extends Effect.Service<ApiClient>()(
  "voidhash-cli/ApiClient",
  {
    dependencies: [FetchHttpClient.layer, CliConfig.Default],
    effect: Effect.gen(function* effect() {
      yield* Effect.logDebug("Initializing API client");
      const cliConfig = yield* CliConfig;
      return yield* HttpApiClient.make(VoidhashV1Api, {
        baseUrl: "http://localhost:5001",
        transformClient: (client) =>
          client.pipe(
            HttpClient.mapRequestEffect((request) =>
              Effect.gen(function* transformClient() {
                const config = yield* cliConfig.readConfig().pipe(
                  Effect.catchAll(() =>
                    Effect.dieMessage("Failed to read config")
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
    }).pipe(Effect.withSpan("ApiClient.make")),
  }
) {}
