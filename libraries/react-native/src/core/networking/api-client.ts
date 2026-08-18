import {
  make as makeCoreClient,
  type VoidhashCoreClient,
  type EvaluateFeatureFlagsBody,
  type SdkEvaluateFeatureFlagsParams,
  type SdkFeatureFlagsResponse,
  type SdkGetPersonParams,
  type SdkGetSchemaParams,
  type SdkIdentifyPersonParams,
  type SdkIdentifyBody,
  type SdkResolvePaywallBody,
  type SdkSyncPersonAttributesBody,
  type SdkSyncPersonAttributesParams,
  type SdkSyncTransactionRequest,
} from "@voidhash/generated-clients";
import { Effect, Layer, Context } from "effect";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";

import type { RuntimeSchema } from "../schema/runtime";
import { SdkConfiguration } from "../sdk-configuration";
import { withHttpDebugLogging } from "./http-debug-client";

export interface ReactNativeFeatureFlagsResponse {
  readonly flags: ReadonlyArray<{
    readonly enabled: boolean;
    readonly key: string;
    readonly payload: unknown;
    readonly variantKey: string | null;
  }>;
}

export interface ReactNativeSyncTransactionRequest {
  readonly appAccountToken?: string | undefined;
  readonly platform: "android" | "ios";
  readonly providerProductId?: string | undefined;
  readonly productSlug: string;
  readonly purchaseDate: number;
  readonly quantity: number;
  readonly receipt?: string | undefined;
  readonly purchaseToken?: string | undefined;
  readonly transactionId: string;
}

interface ReactNativeSdkHeaders {
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
  readonly "x-environment": "production" | "development";
}

export interface ReactNativeDevelopmentPurchaseRequest {
  readonly devTransactionId: string;
  readonly productSlug: string;
  readonly purchaseDate: number;
  readonly quantity?: number;
}

const normalizeFeatureFlagsResponse = (
  response: SdkFeatureFlagsResponse,
): ReactNativeFeatureFlagsResponse => ({
  flags: response.flags.map((flag) => ({
    enabled: flag.enabled,
    key: flag.key,
    payload: null,
    variantKey: flag.variantKey,
  })),
});

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
      Effect.map(
        client.sdkGetSchema(request.headers as SdkGetSchemaParams),
        (response): RuntimeSchema => response as unknown as RuntimeSchema,
      ),
    evaluateFeatureFlags: (request: {
      headers: ReactNativeSdkHeaders;
      payload: EvaluateFeatureFlagsBody;
    }) =>
      Effect.map(
        client.sdkEvaluateFeatureFlags({
          params: request.headers as SdkEvaluateFeatureFlagsParams,
          payload: request.payload,
        }),
        normalizeFeatureFlagsResponse,
      ),
    getPerson: (request: { headers: ReactNativeSdkHeaders }) =>
      client.sdkGetPerson(request.headers as SdkGetPersonParams),
    identify: (request: { headers: ReactNativeSdkHeaders; payload: SdkIdentifyBody }) =>
      client.sdkIdentifyPerson({
        params: request.headers as SdkIdentifyPersonParams,
        payload: request.payload,
      }),
    resolvePaywall: (request: { headers: ReactNativeSdkHeaders; payload: SdkResolvePaywallBody }) =>
      client.sdkResolvePaywall({
        params: request.headers as Parameters<typeof client.sdkResolvePaywall>[0]["params"],
        payload: request.payload,
      }),
    syncPersonAttributes: (request: {
      headers: ReactNativeSdkHeaders;
      payload: SdkSyncPersonAttributesBody;
    }) =>
      client.sdkSyncPersonAttributes({
        params: request.headers as SdkSyncPersonAttributesParams,
        payload: request.payload,
      }),
    syncTransaction: (request: {
      headers: ReactNativeSdkHeaders;
      payload: ReactNativeSyncTransactionRequest;
    }) =>
      client.sdkSyncTransaction({
        params: request.headers as Parameters<typeof client.sdkSyncTransaction>[0]["params"],
        payload: request.payload as SdkSyncTransactionRequest,
      }),
    developmentPurchase: (request: {
      headers: ReactNativeSdkHeaders;
      payload: ReactNativeDevelopmentPurchaseRequest;
    }) =>
      client.sdkDevelopmentPurchase({
        params: request.headers as Parameters<typeof client.sdkDevelopmentPurchase>[0]["params"],
        payload: request.payload,
      }),
  },
});

const make = Effect.gen(function* effect() {
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
    makeCoreClient(httpClient as VoidhashCoreClient["httpClient"], {
      transformClient: () => Effect.succeed(configuredHttpClient),
    }),
  );
});

export class ApiClient extends Context.Service<ApiClient, Effect.Success<typeof make>>()(
  "rn-voidhash/ApiClient",
) {
  static Default = Layer.effect(ApiClient, make);
}
