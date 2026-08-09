import { make as makeEventCaptureClient } from "@voidhash/generated-clients/event-capture";
import { Effect, Layer, Context } from "effect";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";

import { SdkConfiguration } from "../sdk-configuration";

const make = Effect.gen(function* effect() {
  const config = yield* SdkConfiguration;
  const httpClient = yield* HttpClient.HttpClient;
  return makeEventCaptureClient(httpClient, {
    transformClient: (client) =>
      Effect.succeed(
        client.pipe(
          HttpClient.mapRequest((request) =>
            HttpClientRequest.prependUrl(request, config.analytics.baseUrl),
          ),
        ),
      ),
  });
});

export class EventCaptureApiClient extends Context.Service<
  EventCaptureApiClient,
  Effect.Success<typeof make>
>()("web-voidhash/EventCaptureApiClient") {
  static Default = Layer.effect(EventCaptureApiClient, make);
}
