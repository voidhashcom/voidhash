// oxlint-disable effect/noAsyncFunction, effect/noGlobals, effect/noNewError, effect/noTestLifecycleHooks, effect/noThrowStatement -- conformance runner tests drive a real HTTP server with vitest's async API and plain fetch on purpose: the SDK under test must be exercised exactly as application code would use it, not through an Effect test runtime.
import {
  DEVELOPMENT_PURCHASE_REQUEST_FIXTURE,
  DISTINCT_ID,
  FEATURE_FLAGS_FIXTURE,
  HarnessClient,
  PUBLISHABLE_KEY,
  renderReport,
  RESOLVED_PAYWALL_FIXTURE,
  SCHEMA_FIXTURE,
  SDK_PERSON_FIXTURE,
  startHarness,
  SYNC_TRANSACTION_REQUEST_FIXTURE,
  SYNC_TRANSACTION_RESPONSE_FIXTURE,
  type HarnessHandle,
} from "@voidhash/sdk-test-harness";
import { Effect, Exit, Layer } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/unstable/http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ApiClient } from "../src/core/networking/api-client";
import type { ReactNativeSyncTransactionRequest } from "../src/core/networking/api-client";
import { SdkConfiguration, makeSdkConfiguration } from "../src/core/sdk-configuration";
import { ReactNativePlatformProvider } from "../src/core/testing/test-platform-provider";

/**
 * Conformance runner for the React Native SDK: drives the real networking
 * layer (`ApiClient`) over live HTTP against the harness server while
 * executing the shared `mobile/core` scenario suite.
 */
describe("react-native sdk conformance (mobile/core)", () => {
  let handle: HarnessHandle;
  let harness: HarnessClient;

  beforeAll(async () => {
    handle = await startHarness();
    harness = HarnessClient.forHandle(handle);
  });

  afterAll(async () => {
    await handle.shutdown();
  });

  it("executes the full mobile/core scenario in order", async () => {
    const session = await harness.createSession("mobile/core");

    const configuration = makeSdkConfiguration({
      baseUrl: handle.url,
      debug: false,
      developmentMode: true,
      ingestUrl: undefined,
      publishableKey: PUBLISHABLE_KEY,
      readOnly: false,
    });

    // The SDK's request surface carries only the x-* client headers, so the
    // session correlation header is injected at the transport layer instead.
    const SessionHttpClient = Layer.effect(
      HttpClient.HttpClient,
      Effect.map(HttpClient.HttpClient, (client) =>
        client.pipe(
          HttpClient.mapRequest((request) =>
            HttpClientRequest.setHeader(request, "x-harness-session", session.sessionId),
          ),
        ),
      ),
    );

    const ApiLive = ApiClient.Default.pipe(
      Layer.provide(SessionHttpClient),
      Layer.provide(FetchHttpClient.layer),
      Layer.provide(Layer.succeed(SdkConfiguration, configuration.service)),
      Layer.provide(ReactNativePlatformProvider()),
    );

    const headers = {
      "x-client-bundle-id": "com.voidhash.conformance",
      "x-client-locale": "en-US",
      "x-client-version": "1.0.0",
      "x-distinct-id": DISTINCT_ID,
      "x-is-backgrounded": "false" as const,
      "x-is-debug-build": "true" as const,
      "x-nonce": "conformance-nonce-001",
      "x-observer-mode": "false" as const,
      "x-platform": "ios",
      "x-platform-brand": "Test Brand",
      "x-platform-device": "Test Device",
      "x-platform-flavor": "native" as const,
      "x-platform-flavor-version": "1.0.0",
      "x-platform-version": "17.0",
      "x-preferred-locales": "en-US",
      "x-publishable-key": PUBLISHABLE_KEY,
      "x-sdk": "react-native" as const,
      "x-sdk-version": "test",
      "x-environment": "development" as const,
    };

    const program = Effect.gen(function* () {
      const api = yield* ApiClient;

      expect(yield* api.sdk.getSchema({ headers })).toEqual(SCHEMA_FIXTURE);

      expect(
        yield* api.sdk.identify({
          headers,
          payload: { distinctId: DISTINCT_ID, email: "user@example.com", name: "Conformance User" },
        }),
      ).toEqual(SDK_PERSON_FIXTURE);

      expect(yield* api.sdk.getPerson({ headers })).toEqual(SDK_PERSON_FIXTURE);

      expect(
        yield* api.sdk.syncPersonAttributes({
          headers,
          payload: {
            clientEventId: "evt_conformance_001",
            email: "user@example.com",
            name: "Conformance User",
            setOnce: { source: "conformance" },
            traits: { plan: "pro" },
          },
        }),
      ).toEqual(SDK_PERSON_FIXTURE);

      expect(
        yield* api.sdk.evaluateFeatureFlags({
          headers,
          payload: { flagKeys: ["new_paywall", "legacy_flow"] },
        }),
      ).toEqual({
        flags: (
          FEATURE_FLAGS_FIXTURE as {
            flags: Array<{ enabled: boolean; key: string; variantKey: string | null }>;
          }
        ).flags.map((flag) => ({ ...flag, payload: null })),
      });

      expect(
        yield* api.sdk.resolvePaywall({ headers, payload: { locationSlug: "onboarding" } }),
      ).toEqual(RESOLVED_PAYWALL_FIXTURE);

      expect(
        yield* api.sdk.syncTransaction({
          headers,
          payload: SYNC_TRANSACTION_REQUEST_FIXTURE as unknown as ReactNativeSyncTransactionRequest,
        }),
      ).toEqual(SYNC_TRANSACTION_RESPONSE_FIXTURE);

      // The generated client resolves the development purchase without surfacing the body.
      yield* api.sdk.developmentPurchase({
        headers,
        payload: DEVELOPMENT_PURCHASE_REQUEST_FIXTURE as {
          devTransactionId: string;
          productSlug: string;
          purchaseDate: number;
          quantity: number;
        },
      });

      // Guard rejection: the same purchase in production mode is a validation error.
      yield* Effect.tryPromise(async () => {
        const rejected = await fetch(`${handle.url}/api/v1/sdk/development/purchase`, {
          body: JSON.stringify(DEVELOPMENT_PURCHASE_REQUEST_FIXTURE),
          headers: {
            ...headers,
            "content-type": "application/json",
            "x-environment": "production",
            "x-harness-session": session.sessionId,
          },
          method: "POST",
        });
        if (rejected.status !== 400) {
          throw new Error(`Expected 400, got ${rejected.status}`);
        }
      });

      // Scripted 404: the SDK must surface the failure for a missing person.
      const notFound = yield* Effect.exit(api.sdk.getPerson({ headers }));
      expect(Exit.isFailure(notFound)).toBe(true);
    });

    await Effect.runPromise(Effect.provide(program, ApiLive));

    const report = await harness.completeSession(session.sessionId);
    expect(report.pass, renderReport(report)).toBe(true);
  });
});
