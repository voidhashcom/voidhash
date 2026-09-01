import { make as makeEventCaptureClient } from "@voidhash/generated-clients/event-capture";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";

import { SdkConfiguration } from "../sdk-configuration";

const make = Effect.fn("makeEventCaptureApiClient")(function* effect() {
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
  Effect.Success<ReturnType<typeof make>>
>()("web-voidhash/EventCaptureApiClient") {
  static Default = Layer.effect(EventCaptureApiClient, make());
}
