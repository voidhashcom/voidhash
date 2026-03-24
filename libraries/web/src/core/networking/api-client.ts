import { VoidhashV1Api } from "@voidhash/api-spec";
import { Effect, Layer, ServiceMap } from "effect";
import { HttpApiClient } from "effect/unstable/httpapi";

import { SdkConfiguration } from "../sdk-configuration";
import { normalizeGeneratedClient } from "./normalize-generated-client";

const make = Effect.gen(function* effect() {
  const config = yield* SdkConfiguration;
  const rawClient = yield* HttpApiClient.make(VoidhashV1Api, {
    baseUrl: config.baseUrl,
  });
  return normalizeGeneratedClient(rawClient);
});

export class ApiClient extends ServiceMap.Service<
  ApiClient,
  Effect.Success<typeof make>
>()("web-voidhash/ApiClient") {
  static Default = Layer.effect(ApiClient, make);
}
