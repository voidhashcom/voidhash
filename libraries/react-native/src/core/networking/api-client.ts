import { VoidhashV1Api } from "@voidhash/api-spec";
import { Effect, Layer, ServiceMap } from "effect";
import { HttpApiClient } from "effect/unstable/httpapi";

import { SdkConfiguration } from "../sdk-configuration";
import { withHttpDebugLogging } from "./http-debug-client";

const make = Effect.gen(function* effect() {
  const sdkConfiguration = yield* SdkConfiguration;
  return yield* HttpApiClient.make(VoidhashV1Api, {
    baseUrl: sdkConfiguration.baseUrl,
    transformClient: sdkConfiguration.debug
      ? withHttpDebugLogging
      : undefined,
  });
});

export class ApiClient extends ServiceMap.Service<ApiClient, Effect.Success<typeof make>>()("rn-voidhash/ApiClient") {
  static Default = Layer.effect(ApiClient, make)
}
