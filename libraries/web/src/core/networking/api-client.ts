import {
  make as makeCoreClient,
  type VoidhashCoreClient,
  type EvaluateFeatureFlagsBody,
  type SdkEvaluateFeatureFlagsParams,
  type SdkFeatureFlagsResponse,
  type SdkGetPersonParams,
  type SdkIdentifyPersonParams,
  type SdkIdentifyBody,
  type SdkResolvePaywallBody,
  type SdkSyncPersonAttributesBody,
  type SdkSyncPersonAttributesParams,
} from "@voidhash/generated-clients";
import { Effect, Layer, Context } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/unstable/http";

import { SdkConfiguration } from "../sdk-configuration";

interface WebFeatureFlagsResponse {
  readonly flags: ReadonlyArray<{
    readonly enabled: boolean;
    readonly key: string;
    readonly payload: unknown | null;
    readonly variantKey: string | null;
  }>;
}

interface WebSdkHeaders {
  readonly "x-client-bundle-id": string;
  readonly "x-client-locale"?: string | undefined;
  readonly "x-client-version"?: string | undefined;
  readonly "x-distinct-id": string;
  readonly "x-is-backgrounded": "false" | "true";
  readonly "x-is-debug-build": "false" | "true";
  readonly "x-nonce": string;
  readonly "x-observer-mode": "false" | "true";
  readonly "x-platform": string;
  readonly "x-platform-brand"?: string | undefined;
  readonly "x-platform-device"?: string | undefined;
  readonly "x-platform-flavor": "browser" | "native";
  readonly "x-platform-flavor-version"?: string | undefined;
  readonly "x-platform-version"?: string | undefined;
  readonly "x-preferred-locales"?: string | undefined;
  readonly "x-publishable-key": string;
  readonly "x-sdk": "web" | "react-native";
  readonly "x-sdk-version": string;
  readonly "x-storefront"?: string | undefined;
}

const normalizeFeatureFlagsResponse = (
  response: SdkFeatureFlagsResponse
): WebFeatureFlagsResponse => ({
  flags: response.flags.map((flag) => ({
    enabled: flag.enabled,
    key: flag.key,
    payload: null,
    variantKey: flag.variantKey,
  })),
});

const bindWebSdkClient = (client: VoidhashCoreClient) => ({
  sdk: {
    evaluateFeatureFlags: (request: {
      headers: WebSdkHeaders;
      payload: EvaluateFeatureFlagsBody;
    }) =>
      Effect.map(
        client.sdkEvaluateFeatureFlags({
          params: request.headers as SdkEvaluateFeatureFlagsParams,
          payload: request.payload,
        }),
        normalizeFeatureFlagsResponse
      ),
    getPerson: (request: { headers: WebSdkHeaders }) =>
      client.sdkGetPerson(request.headers as SdkGetPersonParams),
    identify: (request: {
      headers: WebSdkHeaders;
      payload: SdkIdentifyBody;
    }) =>
      client.sdkIdentifyPerson({
        params: request.headers as SdkIdentifyPersonParams,
        payload: request.payload,
      }),
    resolvePaywall: (request: {
      headers: WebSdkHeaders;
      payload: SdkResolvePaywallBody;
    }) =>
      client.sdkResolvePaywall({
        params: request.headers as Parameters<typeof client.sdkResolvePaywall>[0]["params"],
        payload: request.payload,
      }),
    syncPersonAttributes: (request: {
      headers: WebSdkHeaders;
      payload: SdkSyncPersonAttributesBody;
    }) =>
      client.sdkSyncPersonAttributes({
        params: request.headers as SdkSyncPersonAttributesParams,
        payload: request.payload,
      }),
  },
});

const make = Effect.gen(function* effect() {
  const config = yield* SdkConfiguration;
  const httpClient = yield* HttpClient.HttpClient;
  return bindWebSdkClient(
    makeCoreClient(httpClient as VoidhashCoreClient["httpClient"], {
      transformClient: (client) =>
        Effect.succeed(
          client.pipe(
            HttpClient.mapRequest((request) =>
              HttpClientRequest.prependUrl(request, config.baseUrl)
            )
          )
        ),
    })
  );
});

export class ApiClient extends Context.Service<
  ApiClient,
  Effect.Success<typeof make>
>()("web-voidhash/ApiClient") {
  static Default = Layer.effect(ApiClient, make);
}
