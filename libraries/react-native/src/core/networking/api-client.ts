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
  type SdkSyncTransactionRequest,
} from "@voidhash/generated-clients";
import { Effect, Layer, ServiceMap } from "effect";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";

import { SdkConfiguration } from "../sdk-configuration";
import { withHttpDebugLogging } from "./http-debug-client";

export interface ReactNativeFeatureFlagsResponse {
  readonly flags: ReadonlyArray<{
    readonly enabled: boolean;
    readonly key: string;
    readonly payload: unknown | null;
    readonly variantKey: string | null;
  }>;
}

export interface ReactNativeSyncTransactionRequest {
  readonly platform: "android" | "ios";
  readonly productId: string;
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
}

const normalizeFeatureFlagsResponse = (
  response: SdkFeatureFlagsResponse
): ReactNativeFeatureFlagsResponse => ({
  flags: response.flags.map((flag) => ({
    enabled: flag.enabled,
    key: flag.key,
    payload: null,
    variantKey: flag.variantKey,
  })),
});

/**
 * Stub error surfaced when the server-side `GET /sdk/schema` endpoint is not
 * yet deployed (the server-side work is tracked separately per the
 * server-first redesign plan). When the endpoint ships, this stub is replaced
 * by a call into the generated client.
 */
const SCHEMA_ENDPOINT_NOT_IMPLEMENTED_MESSAGE =
  "[voidhash] The GET /sdk/schema endpoint is not yet available on the server. " +
  "Schema-dependent hooks (useProducts, usePurchase) will return empty data until it ships. " +
  "See the server-first redesign plan for tracking.";

const bindReactNativeSdkClient = (client: VoidhashCoreClient) => ({
  sdk: {
    /**
     * Fetch the project's schema from the server. Called once on `Provider`
     * mount and cached for the session. Authenticates via the publishable key
     * (same credential the SDK uses for paywall resolution, etc.).
     *
     * TODO(server): wire up `client.sdkGetSchema(...)` once the server endpoint
     * is implemented. For now this returns an empty schema and logs once so
     * the SDK remains usable while the backend work is in flight.
     */
    getSchema: (_request: { headers: ReactNativeSdkHeaders }) =>
      Effect.gen(function* getSchema() {
        yield* Effect.logWarning(SCHEMA_ENDPOINT_NOT_IMPLEMENTED_MESSAGE);
        return {
          version: "",
          products: {} as Readonly<Record<string, never>>,
          locations: {} as Readonly<Record<string, never>>,
          perks: {} as Readonly<Record<string, never>>,
        };
      }),
    evaluateFeatureFlags: (request: {
      headers: ReactNativeSdkHeaders;
      payload: EvaluateFeatureFlagsBody;
    }) =>
      Effect.map(
        client.sdkEvaluateFeatureFlags({
          params: request.headers as SdkEvaluateFeatureFlagsParams,
          payload: request.payload,
        }),
        normalizeFeatureFlagsResponse
      ),
    getCustomer: (request: { headers: ReactNativeSdkHeaders }) =>
      client.sdkGetPerson(request.headers as SdkGetPersonParams),
    identify: (request: {
      headers: ReactNativeSdkHeaders;
      payload: SdkIdentifyBody;
    }) =>
      client.sdkIdentifyPerson({
        params: request.headers as SdkIdentifyPersonParams,
        payload: request.payload,
      }),
    resolvePaywall: (request: {
      headers: ReactNativeSdkHeaders;
      payload: SdkResolvePaywallBody;
    }) =>
      client.sdkResolvePaywall({
        params: request.headers as Parameters<typeof client.sdkResolvePaywall>[0]["params"],
        payload: request.payload,
      }),
    syncCustomerAttributes: (request: {
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
  },
});

const make = Effect.gen(function* effect() {
  const sdkConfiguration = yield* SdkConfiguration;
  const httpClient = yield* HttpClient.HttpClient;
  return bindReactNativeSdkClient(
    makeCoreClient(httpClient as VoidhashCoreClient["httpClient"], {
      transformClient: sdkConfiguration.debug
        ? (client) =>
            Effect.succeed(
              withHttpDebugLogging(client).pipe(
                HttpClient.mapRequest((request) =>
                  HttpClientRequest.prependUrl(request, sdkConfiguration.baseUrl)
                )
              )
            )
        : (client) =>
            Effect.succeed(
              client.pipe(
                HttpClient.mapRequest((request) =>
                  HttpClientRequest.prependUrl(request, sdkConfiguration.baseUrl)
                )
              )
            ),
    })
  );
});

export class ApiClient extends ServiceMap.Service<ApiClient, Effect.Success<typeof make>>()("rn-voidhash/ApiClient") {
  static Default = Layer.effect(ApiClient, make)
}
