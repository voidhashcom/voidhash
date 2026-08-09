/**
 * Integration tests for {@link AppStoreReconciliationService}, run against the
 * real backend stack provisioned once by `test/_testing/globalSetup.ts` (live
 * PlanetScale DB + ClickHouse + WorkOS; only the project schema cache is an
 * in-memory stub).
 *
 * `reconcileOriginalTransaction` is a heavy replay engine: it resolves the
 * payment-provider configuration + project from MySQL, builds a per-tenant
 * App Store SDK context from the stored configuration, then walks Apple's
 * authoritative transaction history and subscription-status snapshot over
 * Apple's live REST API, replaying each event through the `record*` methods of
 * {@link AppStorePaymentProvider}.
 *
 * What this file covers vs. defers
 * --------------------------------
 * Only the prefix of `reconcileOriginalTransaction` that runs *before any
 * Apple network call* can execute in-process against the real DB:
 *  - configuration-not-found (fails before the SDK context is built),
 *  - project-not-found for an otherwise-valid configuration,
 *  - SDK-context build failure when the stored `configuration` blob fails the
 *    `globalConfigurationSchema` decode (still before any HTTP request).
 *
 * Everything past `getTransactionHistoryWithEnvironmentFallback` /
 * `getAllSubscriptionStatusesWithEnvironmentFallback` requires valid Apple
 * signing credentials, Apple's live App Store Server API, and Apple-signed JWS
 * payloads to decode. The service exposes no in-process seam to substitute the
 * SDK context (it is built inline from the configuration), so the happy-path,
 * idempotency-collision, watermark, revocation-routing, status-routing, and
 * environment-fallback cases from the plan are recorded as `test.todo` rather
 * than faked — per the testing brief's "no mocks of things we can run / no
 * faking of things we can't" rule.
 *
 * Conventions:
 *  - The collaborators the service-under-test layer needs but the harness does
 *    not provide (`AppStorePaymentProvider` and its whole record graph) are
 *    wired here from their real layers, mirroring `AppStoreRuntimeLayers.ts` and
 *    the {@link EventProcessorService} integration test. The FX fetcher and the
 *    workflow/queue ports that carry no in-process seam are wired to stubs;
 *    none of them is reached on the pre-network paths exercised here.
 *  - Each test creates its own `payment_provider_configuration` row under the
 *    fixture project with a unique key and cleans it up via `withCleanup`. The
 *    global teardown sweep is only a backstop.
 *  - Typed failures are asserted with `Effect.flip` (project convention),
 *    narrowing the swapped error with `instanceof` (or by `_tag` when the error
 *    class has no package export) before reading its fields, and paired with a
 *    DB-state assertion on the failure path.
 */
import { AppStoreServerSdk } from "@voidhash/app-store-server-sdk";
import { constant } from "@voidhash/lib/lang";
import { generateId } from "@voidhash/core/utils/generate-id";
import { DateTime, Effect, Layer } from "effect";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import { describe, expect, it } from "vitest";

import {
  AppStoreReconciliationConfigurationNotFoundError,
  AppStoreReconciliationService,
} from "@voidhash/core/services/paymentProviders/appStore/app-store-reconciliation-service";
import { AppStorePaymentProvider } from "@voidhash/core/services/paymentProviders/appStore/payment-provider";
import { FxRateService } from "@voidhash/core/services/fxRates/FxRateService";
import { PersonIdentityService } from "@voidhash/core/services/personIdentity/PersonIdentityService";
import { IdentityProjectionPublisher } from "@voidhash/core/services/personIdentity/IdentityProjectionPublisher";
import { PurchaseProcessingService } from "@voidhash/core/services/purchaseProcessing/PurchaseProcessingService";
import { PerkGrantService } from "@voidhash/core/services/perkGrants/PerkGrantService";
import { PaymentConfigSecretCrypto } from "@voidhash/core/utils/crypto/PaymentConfigSecretCrypto";
import { Db, inArray, paymentProviderConfigurations } from "@voidhash/db";

import { CoreAuthSession } from "@testing/CoreAuthSession";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";
import { CoreTestFixture } from "@testing/CoreTestFixture";

const { test } = CoreIntegrationTestHarness.make();

const projectId = CoreTestFixture.projectId;

/** Per-run token plus a monotonic counter so ids/keys stay unique across and within runs. */
const runToken = generateId("test");
let seq = 0;
const unique = (label: string) => `it-asr-${label}-${runToken}-${seq++}`;

/**
 * No-op FX fetcher. The pre-network reconciliation paths exercised here never
 * reach money construction, so this is never invoked; it exists only so
 * {@link FxRateService.layerWithFetcher} can build without the live exchange-
 * rate HTTP dependency.
 */
const stubFxFetcher = {
  fetchLatestUsdRates: () => Effect.succeed([]),
};

/**
 * The completion workflow is resolved lazily by `PersonIdentityService`
 * (surfaces on the effect, not the layer); none of the paths under test
 * dispatches it, so a void stub suffices.
 */
/**
 * Service-under-test layer composed with the full `AppStorePaymentProvider`
 * record graph it depends on, mirroring `stacks/backend/workflows/
 * AppStoreRuntimeLayers.ts`. After this layer the only outstanding requirement
 * is `Db` (plus the harness's own services), satisfying `R extends
 * HarnessServices`. The SDK / FX / person-identity collaborators are real
 * layers; the HTTP client, FX fetcher, identity publisher, and completion
 * workflow are wired to inert variants because the pre-network paths tested
 * here never reach them.
 */
const TestLayer = AppStoreReconciliationService.layer.pipe(
  Layer.provide(
    AppStorePaymentProvider.layer.pipe(
      Layer.provide(AppStoreServerSdk.layer.pipe(Layer.provide(FetchHttpClient.layer))),
      Layer.provide(FxRateService.layerWithFetcher(stubFxFetcher)),
      Layer.provide(PurchaseProcessingService.layer.pipe(Layer.provide(PerkGrantService.layer))),
      Layer.provide(
        PersonIdentityService.layer.pipe(Layer.provide(IdentityProjectionPublisher.noop)),
      ),
      Layer.provide(PaymentConfigSecretCrypto.layer({ key: Effect.succeed("") })),
    ),
  ),
);

/** Read a payment-provider configuration row straight from the DB. */
const findConfigurationRow = (id: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.paymentProviderConfigurations.findFirst({
      where: { id },
    });
  });

/**
 * Insert a `payment_provider_configuration` row under the fixture project with
 * the given configuration blob (or pointing at an explicit project id) and
 * return its id. The blob is stored verbatim, so an invalid one is what the
 * reconciliation engine will fail to decode.
 */
const insertConfiguration = (input: {
  readonly configuration: object;
  readonly projectId?: string;
}) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const id = unique("config");
    const key = unique("bundle");
    yield* db.insert(paymentProviderConfigurations).values({
      configuration: input.configuration,
      enabled: true,
      id,
      name: "Integration App Store config",
      paymentProviderKey: key,
      projectId: input.projectId ?? projectId,
      providerId: "apple-app-store",
    });
    return id;
  });

/** A structurally-valid `globalConfigurationSchema` blob (credentials are dummy). */
const validConfigurationBlob = (): object => ({
  appAppleId: "1234567890",
  appStoreConnectApiIssuerId: "issuer-id",
  appStoreConnectApiKeyId: "api-key-id",
  appStoreConnectApiVendorNumber: "vendor",
  appleServerNotificationForwardingUrl: "",
  appleSmallBusinessProgramHasEndDate: false,
  bundleId: "com.voidhash.integration",
  inAppPurchaseKeyId: "key-id",
  inAppPurchaseKeyIssuerId: "key-issuer-id",
  inAppPurchasePrivateKey: "-----BEGIN PRIVATE KEY-----\nstub\n-----END PRIVATE KEY-----",
  trackNewPurchasesFromAppleServerNotifications: true,
});

/** Delete the given configuration rows; each delete is `ignore`d. */
const cleanupConfigurations = (ids: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    if (ids.length === 0) return;
    const db = yield* Db;
    yield* db
      .delete(paymentProviderConfigurations)
      .where(inArray(paymentProviderConfigurations.id, [...ids]))
      .pipe(Effect.ignore);
  });

/**
 * Wrap a test body so every configuration it creates is removed afterward,
 * regardless of how the test exits. Pass each created id to `track`; cleanup
 * reads the collected ids lazily at finalization via `Effect.ensuring`.
 */
const withCleanup = <E, R>(
  body: (track: (id: string) => void) => Effect.Effect<void, E, R>,
): Effect.Effect<void, E, R | Db> => {
  const createdIds: string[] = [];
  return body((id) => {
    createdIds.push(id);
  }).pipe(Effect.ensuring(cleanupConfigurations(createdIds)));
};

const baseInput = (overrides: {
  readonly paymentProviderConfigurationId: string;
  readonly originalTransactionId?: string;
}) =>
  constant({
    originalTransactionId: overrides.originalTransactionId ?? unique("orig-txn"),
    paymentProviderConfigurationId: overrides.paymentProviderConfigurationId,
    reason: "admin_repair",
    triggeredAt: DateTime.toDateUtc(DateTime.makeUnsafe("2020-01-01T00:00:00.000Z")),
  });

describe("AppStoreReconciliationService.reconcileOriginalTransaction", () => {
  test(
    "fails with AppStoreReconciliationConfigurationNotFoundError for an unknown configuration id",
    // No cleanup wrapper: this path writes nothing (fails before any SDK call).
    Effect.gen(function* () {
      const service = yield* AppStoreReconciliationService;

      const missingId = unique("missing-config");
      const error = yield* Effect.flip(
        service.reconcileOriginalTransaction(
          baseInput({ paymentProviderConfigurationId: missingId }),
        ),
      );

      expect(error).toBeInstanceOf(AppStoreReconciliationConfigurationNotFoundError);
      if (error instanceof AppStoreReconciliationConfigurationNotFoundError) {
        expect(error.paymentProviderConfigurationId).toBe(missingId);
      }

      // Nothing was created for the bogus id.
      const row = yield* findConfigurationRow(missingId);
      expect(row).toBeUndefined();
    }).pipe(Effect.provide(TestLayer), CoreAuthSession.authenticate()),
  );

  test(
    "fails with AppStorePaymentProviderServiceError when the configuration's project is missing",
    withCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* AppStoreReconciliationService;

        // Valid config blob, but pointing at a project that does not exist, so
        // the project lookup fails after the configuration is found and before
        // the SDK context is built.
        const orphanProjectId = unique("missing-project");
        const configId = yield* insertConfiguration({
          configuration: validConfigurationBlob(),
          projectId: orphanProjectId,
        });
        track(configId);

        const error = yield* Effect.flip(
          service.reconcileOriginalTransaction(
            baseInput({ paymentProviderConfigurationId: configId }),
          ),
        );

        // Asserted by tag (the `errors` module has no package export, so the
        // class is not importable here). The `cause` string names the orphaned
        // project id.
        expect(error._tag).toBe("AppStorePaymentProviderServiceError");
        if (error._tag === "AppStorePaymentProviderServiceError") {
          expect(error.cause).toContain(orphanProjectId);
        }

        // The configuration row is untouched by the failed reconciliation.
        const row = yield* findConfigurationRow(configId);
        expect(row).toBeDefined();
        expect(row?.projectId).toBe(orphanProjectId);
      }),
    ).pipe(Effect.provide(TestLayer), CoreAuthSession.authenticate()),
  );

  test(
    "propagates a build error when the stored configuration fails the SDK-context schema decode",
    withCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* AppStoreReconciliationService;

        // A configuration under the real fixture project (so the project lookup
        // succeeds) whose blob is missing every required field. The build of the
        // per-tenant SDK context decodes this blob via `globalConfigurationSchema`
        // and fails there — still before any Apple network call.
        const configId = yield* insertConfiguration({ configuration: {} });
        track(configId);

        const error = yield* Effect.flip(
          service.reconcileOriginalTransaction(
            baseInput({ paymentProviderConfigurationId: configId }),
          ),
        );

        // The decode failure is not one of the two domain errors guarded above;
        // it is a schema decode error surfaced from `buildSdkContextFromConfiguration`.
        expect(error).toBeDefined();
        expect(error).not.toBeInstanceOf(AppStoreReconciliationConfigurationNotFoundError);
        expect(error._tag).not.toBe("AppStoreReconciliationConfigurationNotFoundError");
        expect(error._tag).not.toBe("AppStorePaymentProviderServiceError");

        // The configuration row is untouched by the failed reconciliation.
        const row = yield* findConfigurationRow(configId);
        expect(row).toBeDefined();
        expect(row?.projectId).toBe(projectId);
      }),
    ).pipe(Effect.provide(TestLayer), CoreAuthSession.authenticate()),
  );

  // ----------------------------------------------------------------------------
  // Apple-dependent paths: deferred.
  //
  // Each of the following walks Apple's live App Store Server API
  // (`getTransactionHistoryWithEnvironmentFallback` /
  // `getAllSubscriptionStatusesWithEnvironmentFallback`) and decodes Apple-signed
  // JWS payloads with the per-tenant `SignedDataVerifier`. The reconciliation
  // service builds its SDK context inline from the stored configuration and
  // exposes no in-process seam to substitute it, so these cannot run against the
  // real DB without valid Apple credentials + a recorded sandbox transaction.
  // They are recorded here (not faked) so the coverage intent is preserved.
  // ----------------------------------------------------------------------------

  it.todo(
    "happy path: walks the full ascending transaction history + status snapshot for a known originalTransactionId and reports transactionsProcessed/statusesProcessed/eventsApplied — DEFERRED: needs Apple's live App Store Server API history/status responses and signed JWS for a seeded sandbox originalTransactionId (no in-process SDK-context seam)",
  );

  it.todo(
    "idempotency: re-running reconciliation after a live event collides on the per-event purchase_ledger.idempotency_key UNIQUE and reports the replays as eventsSkippedIdempotent (idempotent=true) — DEFERRED: requires real Apple history responses to drive the record* idempotency gate end-to-end",
  );

  it.todo(
    "transaction decode failure increments eventsFailed and skips that transaction (logs a warning, continues the walk) — DEFERRED: requires Apple history responses containing an undecodable signedTransactions entry",
  );

  it.todo(
    "status snapshot signedRenewalInfo decode failure is swallowed (Option.none) and the snapshot still replays — DEFERRED: requires an Apple subscription-status response with a malformed signedRenewalInfo",
  );

  it.todo(
    "ACTIVE status snapshot is counted as statusesProcessed but is a no-op (_replayStatusSnapshot returns undefined) — DEFERRED: requires Apple subscription-status response with an ACTIVE lastTransactions item",
  );

  it.todo(
    "revocation routing distinguishes family_revoke vs refund via revocationType in the history walk — DEFERRED: requires Apple history transactions carrying revocationDate + revocationType",
  );

  it.todo(
    "auto-renewable RENEWAL history transaction routes to recordSubscriptionRenewed — DEFERRED: requires an Apple history transaction with type=AUTO_RENEWABLE and transactionReason=RENEWAL",
  );

  it.todo(
    "EXPIRED status routes to recordSubscriptionExpired; BILLING_RETRY / GRACE_PERIOD route to recordBillingRetry; REVOKED routes to recordEntitlementRevoked — DEFERRED: requires Apple subscription-status responses with the corresponding Status values",
  );

  it.todo(
    "all record* calls pass source=\"reconciliation\", so purchase_ledger.source is recorded as 'reconciliation' — DEFERRED: depends on the happy path above persisting a ledger row driven by Apple history",
  );

  it.todo(
    "watermark guard: a reconciliation arriving after a fresher live event does not regress subscription.last_event_occurred_at — DEFERRED: requires both a live-event write and an Apple history walk over the same originalTransactionId",
  );

  it.todo(
    "environment fallback: resolvedEnvironment is Sandbox vs Production per getTransactionHistoryWithEnvironmentFallback's production-then-sandbox probing — DEFERRED: requires Apple production/sandbox API responses to drive the fallback",
  );
});
