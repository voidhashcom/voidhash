import { EventCaptureApi } from "@voidhash/api-spec/event-capture";
import { Effect, Layer, ServiceMap } from "effect";
import { HttpApiClient } from "effect/unstable/httpapi";

import { SdkConfiguration } from "../sdk-configuration";
import { normalizeGeneratedClient } from "./normalize-generated-client";
import { toJsonCompatibleApi } from "./json-compatible-api";

const make = Effect.gen(function* effect() {
  const config = yield* SdkConfiguration;
  const rawClient = yield* HttpApiClient.make(toJsonCompatibleApi(EventCaptureApi), {
    baseUrl: config.analytics.baseUrl,
  });
  return normalizeGeneratedClient(rawClient);
});

export class EventCaptureApiClient extends ServiceMap.Service<
  EventCaptureApiClient,
  Effect.Success<typeof make>
>()("web-voidhash/EventCaptureApiClient") {
  static Default = Layer.effect(EventCaptureApiClient, make);
}
