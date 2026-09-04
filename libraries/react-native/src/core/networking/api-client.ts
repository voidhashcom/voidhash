import {
  make as makeCoreClient,
  type VoidhashCoreClient,
  type EvaluateFeatureFlagsBody,
  type SdkDevelopmentPurchaseBodyJsonEncoding,
  type SdkFeatureFlagsResponse,
  type SdkGetSdkSchemaParams,
  type SdkIdentifyBody,
  type SdkResolvePaywallBody,
  type SdkSyncPersonAttributesBody,
  type SdkSyncTransactionRequest,
} from "@voidhash/generated-clients";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Context from "effect/Context";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";

import { RuntimeSchemaValue } from "../schema/runtime";
import { SdkConfiguration } from "../sdk-configuration";
import { withHttpDebugLogging } from "./http-debug-client";

export interface ReactNativeFeatureFlagsResponse {
  readonly flags: ReadonlyArray<{
    readonly enabled: boolean;
    readonly key: string;
    readonly payload: unknown;
    readonly variantKey: Option.Option<string>;
  }>;
}

export type ReactNativeSyncTransactionRequest = SdkSyncTransactionRequest;
export type ReactNativeSdkHeaders = SdkGetSdkSchemaParams;
export type ReactNativeDevelopmentPurchaseRequest = SdkDevelopmentPurchaseBodyJsonEncoding;

const normalizeFeatureFlagsResponse = (
  response: SdkFeatureFlagsResponse,
): ReactNativeFeatureFlagsResponse => ({
  flags: response.flags.map((flag) => ({
    enabled: flag.enabled,
    key: flag.key,
    payload: null,
    variantKey: Option.fromNullishOr(flag.variantKey),
  })),
});

const requireExplicitAcceptance = <Response extends { readonly accepted: boolean }>(
  response: Response,
) => Effect.as(Schema.decodeUnknownEffect(Schema.Boolean)(response.accepted), response);

/** Binds the generated core client to the React Native SDK request surface. */
export const bindReactNativeSdkClient = (client: VoidhashCoreClient) => ({
  sdk: {
    /**
     * Fetch the project's schema from the server. Called once on `Provider`
     * mount and cached for the session. Authenticates via the publishable key
     * (same credential the SDK uses for paywall resolution, etc.).
     *
     * The server's `SdkSchema` response is structurally identical to
     * `RuntimeSchema` (slug-keyed records). The generated client types the
     * nested fields loosely as `Record<string, unknown>`; we tighten the
     * boundary with a cast here so the rest of the SDK can treat it as a
     * `RuntimeSchema`.
     */
    getSchema: (request: { headers: ReactNativeSdkHeaders }) =>
      Effect.flatMap(
        client.sdkGetSdkSchema(request.headers),
        Schema.decodeUnknownEffect(RuntimeSchemaValue),
      ),
    evaluateFeatureFlags: (request: {
      headers: ReactNativeSdkHeaders;
      payload: EvaluateFeatureFlagsBody;
    }) =>
      Effect.map(
        client.sdkEvaluateFeatureFlags({
          params: request.headers,
          payload: request.payload,
        }),
        normalizeFeatureFlagsResponse,
      ),
    getPerson: (request: { headers: ReactNativeSdkHeaders }) =>
      client.sdkGetPerson(request.headers),
    identify: (request: { headers: ReactNativeSdkHeaders; payload: SdkIdentifyBody }) =>
      client.sdkIdentifyPerson({
        params: request.headers,
        payload: request.payload,
      }),
    resolvePaywall: (request: { headers: ReactNativeSdkHeaders; payload: SdkResolvePaywallBody }) =>
      client.sdkResolvePaywall({
        params: request.headers,
        payload: request.payload,
      }),
    syncPersonAttributes: (request: {
      headers: ReactNativeSdkHeaders;
      payload: SdkSyncPersonAttributesBody;
    }) =>
      client.sdkSyncPersonAttributes({
        params: request.headers,
        payload: request.payload,
      }),
    syncTransaction: (request: {
      headers: ReactNativeSdkHeaders;
      payload: ReactNativeSyncTransactionRequest;
    }) =>
      Effect.flatMap(
        client.sdkSyncTransaction({
          params: request.headers,
          payload: request.payload,
        }),
        requireExplicitAcceptance,
      ),
    developmentPurchase: (request: {
      headers: ReactNativeSdkHeaders;
      payload: ReactNativeDevelopmentPurchaseRequest;
    }) =>
      Effect.flatMap(
        client.sdkDevelopmentPurchase({
          params: request.headers,
          payload: request.payload,
        }),
        requireExplicitAcceptance,
      ),
  },
});

const make = Effect.fn("makeApiClient")(function* effect() {
  const sdkConfiguration = yield* SdkConfiguration;
  const httpClient = yield* HttpClient.HttpClient;
  const configuredHttpClient = (
    sdkConfiguration.debug ? withHttpDebugLogging(httpClient) : httpClient
  ).pipe(
    HttpClient.mapRequest((request) =>
      HttpClientRequest.prependUrl(request, sdkConfiguration.baseUrl).pipe(
        HttpClientRequest.setHeader("x-environment", sdkConfiguration.environmentMode),
      ),
    ),
  );
  return bindReactNativeSdkClient(
    makeCoreClient(httpClient, {
      transformClient: () => Effect.succeed(configuredHttpClient),
    }),
  );
});

export class ApiClient extends Context.Service<
  ApiClient,
  Effect.Success<ReturnType<typeof make>>
>()("rn-voidhash/ApiClient") {
  static Default = Layer.effect(ApiClient, make());
}
