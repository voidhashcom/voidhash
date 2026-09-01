import {
  make as makeCoreClient,
  type VoidhashCoreClient,
  type EvaluateFeatureFlagsBody,
  type SdkFeatureFlagsResponse,
  type SdkIdentifyBody,
  type SdkResolvePaywallBody,
  type SdkSyncPersonAttributesBody,
} from "@voidhash/generated-clients";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";
import * as Option from "effect/Option";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";

import { SdkConfiguration } from "../sdk-configuration";

interface WebFeatureFlagsResponse {
  readonly flags: ReadonlyArray<{
    readonly enabled: boolean;
    readonly key: string;
    readonly payload: unknown;
    readonly variantKey: Option.Option<string>;
  }>;
}

export interface WebSdkHeaders {
  readonly "x-client-bundle-id": string;
  readonly "x-client-locale"?: string;
  readonly "x-client-version"?: string;
  readonly "x-distinct-id": string;
  readonly "x-is-backgrounded": "false" | "true";
  readonly "x-is-debug-build": "false" | "true";
  readonly "x-nonce": string;
  readonly "x-observer-mode": "false" | "true";
  readonly "x-platform": string;
  readonly "x-platform-brand"?: string;
  readonly "x-platform-device"?: string;
  readonly "x-platform-flavor": "browser" | "native";
  readonly "x-platform-flavor-version"?: string;
  readonly "x-platform-version"?: string;
  readonly "x-preferred-locales"?: string;
  readonly "x-publishable-key": string;
  readonly "x-sdk": "web" | "react-native";
  readonly "x-sdk-version": string;
  readonly "x-storefront"?: string;
}

/** SDK headers as produced by the platform provider, before identity is known. */
export type WebSdkHeadersWithoutDistinctId = Omit<WebSdkHeaders, "x-distinct-id">;

/**
 * The generated OpenAPI parameter types collapse every boolean-ish SDK header
 * enum down to the single literal `"false"`, so a real header object (which can
 * legitimately carry `"true"`) is not structurally assignable to them. This is
 * the one place that bridges the generator gap; every endpoint binding below
 * goes through it instead of asserting at the call site.
 *
 * The widening lives in the overload pair rather than in a call-site assertion:
 * the implementation honestly returns `unknown`, and the single declared
 * signature is the one seam the generator gap is allowed to pass through.
 */
function toSdkParams<TParams>(headers: WebSdkHeaders): TParams;
function toSdkParams(headers: WebSdkHeaders): unknown {
  return headers;
}

const normalizeFeatureFlagsResponse = (
  response: SdkFeatureFlagsResponse,
): WebFeatureFlagsResponse => ({
  flags: response.flags.map((flag) => ({
    enabled: flag.enabled,
    key: flag.key,
    payload: null,
    variantKey: Option.fromNullishOr(flag.variantKey),
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
          params: toSdkParams(request.headers),
          payload: request.payload,
        }),
        normalizeFeatureFlagsResponse,
      ),
    getPerson: (request: { headers: WebSdkHeaders }) =>
      client.sdkGetPerson(toSdkParams(request.headers)),
    identify: (request: { headers: WebSdkHeaders; payload: SdkIdentifyBody }) =>
      client.sdkIdentifyPerson({
        params: toSdkParams(request.headers),
        payload: request.payload,
      }),
    resolvePaywall: (request: { headers: WebSdkHeaders; payload: SdkResolvePaywallBody }) =>
      client.sdkResolvePaywall({
        params: toSdkParams(request.headers),
        payload: request.payload,
      }),
    syncPersonAttributes: (request: {
      headers: WebSdkHeaders;
      payload: SdkSyncPersonAttributesBody;
    }) =>
      client.sdkSyncPersonAttributes({
        params: toSdkParams(request.headers),
        payload: request.payload,
      }),
  },
});

const make = Effect.fn("makeApiClient")(function* effect() {
  const config = yield* SdkConfiguration;
  const httpClient = yield* HttpClient.HttpClient;
  return bindWebSdkClient(
    makeCoreClient(httpClient, {
      transformClient: (client) =>
        Effect.succeed(
          client.pipe(
            HttpClient.mapRequest((request) =>
              HttpClientRequest.prependUrl(request, config.baseUrl),
            ),
          ),
        ),
    }),
  );
});

export class ApiClient extends Context.Service<
  ApiClient,
  Effect.Success<ReturnType<typeof make>>
>()(
  "web-voidhash/ApiClient",
) {
  static Default = Layer.effect(ApiClient, make());
}
