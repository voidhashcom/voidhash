/**
 * Integration tests for {@link AppStorePaymentProviderService} — specifically
 * its live implementation `AppStorePaymentProviderServiceLive` and the single
 * public SDK-path method `processSdkTransaction`
 * (`src/services/paymentProviders/appStore/payment-provider-service.ts`).
 *
 * `processSdkTransaction` runs four stages in order:
 *   1. resolve the enabled configuration for `input.bundleId` under
 *      `input.projectId` (DB read + pure key match),
 *   2. resolve the project from `input.projectId` (DB read),
 *   3. build the per-tenant Apple SDK context and call
 *      `getTransactionInfo` (live Apple HTTPS) + `decodeSignedTransaction`
 *      (JWS verification against Apple root certs),
 *   4. forward the decoded transaction to `AppStorePaymentProvider.recordPurchase`.
 *
 * STAGE 3 IS THE HARD WALL. Once a configuration resolves, the method calls
 * `appStorePaymentProvider.buildSdkContextFromConfiguration(configuration)`,
 * which builds a *real* `AppStoreServerSdkClient` + `SignedDataVerifier` (see
 * `appStore/sdk-context.ts`), then calls `sdkContext.getTransactionInfo(...)` —
 * a live HTTPS request to Apple's App Store Server API — and
 * `sdkContext.decodeSignedTransaction(...)` — real X.509 chain + JWS signature
 * verification against Apple's root certificates. The SDK context is built
 * *internally*; there is no override seam to inject a fake context, and the
 * testing brief defers any path that needs an Apple-signed JWS payload or an
 * external provider sandbox to `test.todo` rather than hand-rolling a double.
 * So every happy-path case and every post-configuration error case (missing
 * `signedTransactionInfo`, SDK/verification error, `recordPurchase` failure) is
 * deferred — they cannot run in-process against real infrastructure.
 *
 * STAGE 1 (configuration-not-found), HOWEVER, RUNS FULLY IN-PROCESS and is
 * implemented below as a real harness test. The live layer *can* be built
 * against harness `Db` + `AuthSession`: `AppStorePaymentProviderServiceLive`
 * provides `AppStoreWebhookHandlerService.layer` (which merges
 * `AppStorePaymentProvider.layer`), and its residual deps
 * (`PurchaseProcessingService`, `PersonIdentityService`, `FxRateService`,
 * `PaymentConfigSecretCrypto`, `AppStoreServerSdk`) all bottom out at the
 * harness `Db` once given the same leaf stubs the sibling
 * `AppStorePaymentProvider.integration.test.ts` already uses (which exercises
 * `recordPurchase` end-to-end — there is NO ambient `Cloudflare.Worker`
 * requirement on the record path; the `as unknown as` cast in the source only
 * erases the *service-shape* `R` for the public contract, it does not gate
 * layer construction). With no enabled configuration for the input `bundleId`,
 * `getActiveAppStorePaymentProviderConfiguration` fails *before* the SDK
 * boundary is reached, and `processSdkTransaction`'s `toServiceError` wrapper
 * collapses that into the public {@link AppStorePaymentProviderServiceError}.
 *
 * See the sibling suite `AppStorePaymentProvider.integration.test.ts` for the
 * record-engine layer idiom and `appStore/sdk-context.test.ts` for the SDK
 * boundary todos.
 */
import { Effect, Layer } from "effect";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import { describe, expect, test as vitestTest } from "vitest";

import { AppStoreServerSdk } from "@voidhash/app-store-server-sdk";
import {
  FxRateService,
  IdentityProjectionPublisher,
  PerkGrantService,
  PersonIdentityService,
  PurchaseProcessingService,
} from "@voidhash/core/services";
import { AppStorePaymentProvider } from "@voidhash/core/services/paymentProviders/appStore/payment-provider";
import {
  AppStorePaymentProviderService,
  // Import the error from the SAME module the source throws it from
  // (`paymentProviders/AppStorePaymentProviderService.ts`, re-exported by the
  // `@voidhash/core/services` barrel). The look-alike class in
  // `appStore/errors.ts` shares the `_tag` string but is a DISTINCT runtime
  // class, so `toBeInstanceOf` against it fails even when the tag matches.
  AppStorePaymentProviderServiceError,
} from "@voidhash/core/services";
import { IdentifyDistinctIdCompletionWorkflow } from "@voidhash/core/services/personIdentity/IdentifyDistinctIdCompletionWorkflow";
import { PaymentConfigSecretCrypto } from "@voidhash/core/utils/crypto/PaymentConfigSecretCrypto";
// The live layer has no public package subpath, so it is imported by relative
// path into `src` (the App-Store unit-test convention used by the sibling
// engine suite for the error classes).
import { AppStorePaymentProviderServiceLive } from "../../../../src/services/paymentProviders/appStore/payment-provider-service.ts";

import { CoreAuthSession } from "@testing/CoreAuthSession";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";
import { CoreTestFixture } from "@testing/CoreTestFixture";

const { test } = CoreIntegrationTestHarness.make();

const projectId = CoreTestFixture.projectId;

/** Monotonic counter so generated ids stay unique even within one millisecond. */
let seq = 0;
const uniq = (label: string) => `it-asps-${label}-${Date.now()}-${seq++}`;

/**
 * In-memory no-op for the async identity-migration completion workflow (the
 * real adapter is a Cloudflare Workflow at the application root). The
 * configuration-not-found path never dispatches it, but it is part of the
 * `PersonIdentityService` dependency graph, so it must be provided to build
 * the layer.
 */
const CompletionWorkflowStub = Layer.succeed(IdentifyDistinctIdCompletionWorkflow, {
  dispatch: () => Effect.void,
});

/**
 * Full dependency graph for `AppStorePaymentProviderServiceLive`. Mirrors the
 * sibling engine suite's `AppStoreEngineLive`: every node is either a real
 * `Db`-backed service or a leaf stub with no infrastructure of its own, so the
 * only requirements that escape are the harness `Db` and the per-test
 * `AuthSession` supplied by `CoreAuthSession.authenticate`.
 */
const AppStoreServiceLive = AppStorePaymentProviderServiceLive.pipe(
  Layer.provide(
    AppStorePaymentProvider.layer.pipe(
      Layer.provideMerge(
        Layer.mergeAll(
          PurchaseProcessingService.layer,
          PersonIdentityService.layer,
          FxRateService.layer({ apiKey: Effect.succeed("test-fx-key") }),
          PaymentConfigSecretCrypto.layer({ key: Effect.succeed("") }),
          AppStoreServerSdk.layer.pipe(Layer.provide(FetchHttpClient.layer)),
        ),
      ),
      Layer.provideMerge(
        Layer.mergeAll(
          PerkGrantService.layer,
          IdentityProjectionPublisher.noop,
          CompletionWorkflowStub,
        ),
      ),
    ),
  ),
);

describe("AppStorePaymentProviderService.processSdkTransaction", () => {
  // --- Error aggregation: configuration-not-found (RUNNABLE, pre-SDK) ---------
  // The cheapest and only in-process-reachable branch: with no enabled
  // configuration for the input bundleId,
  // `getActiveAppStorePaymentProviderConfiguration` fails with
  // `AppStorePaymentProviderNotEnabledForFollowingBundleIdError` BEFORE the SDK
  // boundary, and `processSdkTransaction`'s `toServiceError` wrapper collapses
  // it into the public `AppStorePaymentProviderServiceError`. The fixture
  // project has no apple-app-store configuration matching this unique bundleId,
  // so nothing is seeded and nothing is written — there is nothing to clean up.
  test(
    "configuration-not-found (no enabled config for bundleId) aggregates to AppStorePaymentProviderServiceError",
    Effect.gen(function* () {
      const service = yield* AppStorePaymentProviderService;

      const error = yield* Effect.flip(
        service.processSdkTransaction({
          bundleId: uniq("missing-bundle"),
          distinctId: uniq("distinct"),
          projectId,
          receivedAt: new Date(),
          transactionId: uniq("tx"),
        }),
      );

      // The public boundary collapses the whole upstream error union into the
      // single `AppStorePaymentProviderServiceError` tag (not the internal
      // `NotEnabledForFollowingBundleId` business error).
      expect(error).toBeInstanceOf(AppStorePaymentProviderServiceError);
      expect(typeof error.cause).toBe("string");
    }).pipe(Effect.provide(AppStoreServiceLive), CoreAuthSession.authenticate()),
  );

  // --- Happy-path orchestration (needs a live Apple call + JWS) ---------------
  // Each step below resolves a real configuration, then reaches the SDK
  // boundary (live Apple REST `getTransactionInfo` + JWS verification against
  // Apple root certs) which cannot run in-process. The SDK context is built
  // internally by `buildSdkContextFromConfiguration` with no stub seam, and the
  // testing brief disallows faking the Apple response. Implement once an
  // in-process seam exists to inject a well-formed decoded transaction WITHOUT
  // a live Apple call.

  vitestTest.todo(
    "resolves the enabled configuration for the input bundleId before calling the SDK — deferred: the success path continues into the SDK boundary (live Apple getTransactionInfo + JWS verification) which cannot run in-process; only the configuration-not-found short-circuit (above) is reachable",
  );

  vitestTest.todo(
    "fetches transaction info from the per-tenant Apple SDK context (getTransactionInfo) — deferred: needs a live Apple App Store Server API call; the SDK context is built internally and has no stub seam, and faking the Apple response is disallowed",
  );

  vitestTest.todo(
    "decodes signedTransactionInfo from the SDK response (decodeSignedTransaction) — deferred: needs a real Apple-signed JWS verified against Apple root certificates; cannot be faked per the testing brief",
  );

  vitestTest.todo(
    "routes the decoded transaction to recordPurchase with source='sdk' and persists the purchase/subscription rows — deferred: reaching recordPurchase requires the upstream live Apple getTransactionInfo + JWS decode to succeed first, which cannot run in-process (recordPurchase itself IS exercised directly in the sibling AppStorePaymentProvider engine suite)",
  );

  vitestTest.todo(
    "includes the input distinctId in the recordPurchase input so the purchase binds to the SDK person — deferred: blocked by the same upstream SDK getTransactionInfo + JWS decode boundary as the recordPurchase routing case",
  );

  vitestTest.todo(
    "resolves the project from input.projectId and propagates it into recordPurchase — deferred: project is read after configuration resolution and before the unrunnable live-Apple SDK fetch, so the success path cannot be reached in-process",
  );

  vitestTest.todo(
    "returns { personId } from recordPurchase on success — deferred: success requires a real Apple-signed transaction fetched + decoded via the live SDK boundary",
  );

  // --- Error aggregation to AppStorePaymentProviderServiceError (post-SDK) ----
  // These branches all fire at or after the SDK call, so they require driving
  // the live Apple REST / JWS verification path.

  vitestTest.todo(
    "project-not-found (input.projectId has no projects row) dies at the public boundary — deferred: reaching the project lookup requires a matching enabled configuration to resolve first, but configurations are FK-scoped to a real projects row, so an orphan config can't exist via normal seeding; and the source uses Effect.die (a defect, not caught by the toServiceError failure wrapper), so it surfaces as a defect rather than an aggregated AppStorePaymentProviderServiceError",
  );

  vitestTest.todo(
    "missing signedTransactionInfo on the SDK response aggregates to AppStorePaymentProviderServiceError — deferred: requires a real SDK getTransactionInfo response we can only obtain from a live Apple sandbox",
  );

  vitestTest.todo(
    "SDK error (VerificationError / Apple HTTP error) aggregates to AppStorePaymentProviderServiceError — deferred: requires driving the real Apple REST/JWS verification path to fail; faking the SDK is disallowed",
  );

  vitestTest.todo(
    "recordPurchase failure aggregates to AppStorePaymentProviderServiceError — deferred: reaching recordPurchase requires a real decoded Apple transaction from the live SDK boundary",
  );
});
