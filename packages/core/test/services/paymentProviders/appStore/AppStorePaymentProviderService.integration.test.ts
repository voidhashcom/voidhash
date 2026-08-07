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
 *   3. verify the transaction through `AppStoreTransactionVerifier`,
 *   4. forward the decoded transaction to `AppStorePaymentProvider.recordPurchase`.
 *
 * The success case replaces only the external verifier and keeps configuration
 * lookup, project lookup, product mapping, identity binding, purchase
 * processing, and database writes live. Production supplies a verifier backed
 * by Apple's REST client and signed-data verifier.
 */
import { Data, DateTime, Effect, Exit, Layer } from "effect";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http";
import { describe, expect, test as vitestTest } from "vitest";

import {
  AppStoreServerSdk,
  Type as AppleTransactionType,
  decodeJWSTransactionDecodedPayload,
} from "@voidhash/app-store-server-sdk";
import {
  FxRateService,
  GooglePlayPaymentProviderService,
  IdentityProjectionPublisher,
  PerkGrantService,
  PersonIdentityService,
  PurchaseProcessingService,
  PurchaseService,
  SdkService,
} from "@voidhash/core/services";
import type { PublishableKeySession } from "@voidhash/core/domain/auth/Auth";
import { AppStorePaymentProvider } from "@voidhash/core/services/paymentProviders/appStore/payment-provider";
import {
  AppStorePaymentProviderService,
  // Import the error from the SAME module the source throws it from
  // (`paymentProviders/AppStorePaymentProviderService.ts`, re-exported by the
  // `@voidhash/core/services` barrel). The look-alike class in
  // `appStore/errors.ts` shares the `_tag` string but is a DISTINCT runtime
  // class, so `toBeInstanceOf` against it fails even when the tag matches.
  AppStorePaymentProviderServiceError,
  AppStoreTransactionVerifier,
} from "@voidhash/core/services";
import { PaymentConfigSecretCrypto } from "@voidhash/core/utils/crypto/PaymentConfigSecretCrypto";
import { deriveAccountToken } from "@voidhash/core/utils/crypto/account-token";
import { generateId } from "@voidhash/core/utils";
import { make as makeGeneratedClient } from "@voidhash/generated-clients";
import {
  Db,
  ProviderEnvironment,
  eq,
  paymentProviderConfigurationProducts,
  paymentProviderConfigurations,
  personExternalIdentifiers,
  personIdentities,
  persons,
  products,
  purchaseLedger,
  purchases,
  transactions,
} from "@voidhash/db";
// The live layer has no public package subpath, so it is imported by relative
// path into `src` (the App-Store unit-test convention used by the sibling
// engine suite for the error classes).
import { AppStorePaymentProviderServiceLive } from "../../../../src/services/paymentProviders/appStore/payment-provider-service.ts";

import { CoreAuthSession } from "@testing/CoreAuthSession";
import { PurchaseIntegrationTestHarness } from "@testing/PurchaseIntegrationTestHarness";
import { CoreTestFixture } from "@testing/CoreTestFixture";
import {
  makeReactNativePurchaseHarness,
  type RuntimeSchema,
  Transaction as ReactNativeTransaction,
} from "@testing/ReactNativePurchaseHarness";
import { makePurchaseSdkHttpHandler } from "../../../../../backend/src/testing/PurchaseSdkHttpHarness.ts";

const { test } = PurchaseIntegrationTestHarness.make();

const projectId = CoreTestFixture.projectId;

/** Wall-clock helpers — `DateTime` equivalents of `nowMillis()` / `new Date(...)`. */
const nowMillis = (): number => DateTime.toEpochMillis(DateTime.nowUnsafe());
const nowDate = (): Date => DateTime.toDateUtc(DateTime.nowUnsafe());

/** Simulated native-side failures the harness surfaces to the SDK under test. */
class SimulatedNativeFailure extends Data.TaggedError("SimulatedNativeFailure")<{
  readonly message: string;
}> {}

/** Monotonic counter so generated ids stay unique even within one millisecond. */
let seq = 0;
const uniq = (label: string) => `it-asps-${label}-${nowMillis()}-${seq++}`;

/**
 * In-memory no-op for the async identity-migration completion workflow (the
 * real adapter is a Cloudflare Workflow at the application root). The
 * configuration-not-found path never dispatches it, but it is part of the
 * `PersonIdentityService` dependency graph, so it must be provided to build
 * the layer.
 */
const googlePlayStub = Layer.succeed(GooglePlayPaymentProviderService, {
  acceptRtdnNotification: () => Effect.die("Google Play webhook must not run"),
  processSdkTransaction: () => Effect.die("Google Play purchase must not run"),
});

const sdkSession = (distinctId: string): PublishableKeySession => ({
  cookie: null,
  method: "publishable-key",
  name: "Purchase integration SDK",
  organizations: [
    {
      id: CoreTestFixture.organizationId,
      logo: null,
      name: CoreTestFixture.organizationName,
      permissions: ["organization:read"],
      slug: CoreTestFixture.organizationSlug,
      workosOrganizationId: CoreTestFixture.workosOrganizationId,
    },
  ],
  person: { distinctId },
  projects: [
    {
      id: projectId,
      logo: null,
      name: CoreTestFixture.projectName,
      organizationId: CoreTestFixture.organizationId,
      permissions: ["project:read"],
      slug: CoreTestFixture.projectSlug,
    },
  ],
  user: null,
});

/**
 * Full dependency graph for `AppStorePaymentProviderServiceLive`. Mirrors the
 * sibling engine suite's `AppStoreEngineLive`: every node is either a real
 * `Db`-backed service or a leaf stub with no infrastructure of its own, so the
 * only requirements that escape are the harness `Db` and the per-test
 * authentication session supplied by the in-process SDK HTTP harness.
 */
const AppStoreEngineLive = AppStorePaymentProvider.layer.pipe(
  Layer.provideMerge(
    Layer.mergeAll(
      PurchaseProcessingService.layer,
      PersonIdentityService.layer,
      FxRateService.layer({ apiKey: Effect.succeed("test-fx-key") }),
      PaymentConfigSecretCrypto.layer({ key: Effect.succeed("") }),
      AppStoreServerSdk.layer.pipe(Layer.provide(FetchHttpClient.layer)),
    ),
  ),
  Layer.provideMerge(Layer.mergeAll(PerkGrantService.layer, IdentityProjectionPublisher.noop)),
);

const AppStoreServiceLive = AppStorePaymentProviderServiceLive.pipe(
  Layer.provide(
    Layer.succeed(AppStoreTransactionVerifier, {
      verify: () =>
        Effect.fail(
          new SimulatedNativeFailure({ message: "App Store verifier must not run in this test" }),
        ),
    }),
  ),
  Layer.provide(AppStoreEngineLive),
);

describe("AppStorePaymentProviderService.processSdkTransaction", () => {
  test(
    "runs purchase, retry, restore, verification, and persistence end to end",
    Effect.gen(function* () {
      const db = yield* Db;
      const distinctId = uniq("person");
      const accountToken = yield* deriveAccountToken(distinctId);
      const bundleId = `com.voidhash.${uniq("bundle").replaceAll("-", "")}`;
      const providerProductKey = uniq("lifetime");
      const productSlug = uniq("lifetime-slug");
      const transactionId = uniq("transaction");
      const configurationId = generateId("paymentProviderConfiguration");
      const providerProductId = generateId("paymentProviderProduct");
      const productId = generateId("product");
      const purchasedAt = nowMillis();
      const idempotencyKey = `apple:${transactionId}:purchase:${purchasedAt}`;
      let personId: string | undefined;
      let disposeHttp: (() => Promise<void>) | undefined;
      const disposeReactNative: Array<() => Promise<void>> = [];

      const cleanup = Effect.gen(function* () {
        for (const dispose of disposeReactNative) {
          yield* Effect.promise(dispose);
        }
        if (disposeHttp) {
          yield* Effect.promise(disposeHttp);
        }
        yield* db
          .delete(purchaseLedger)
          .where(eq(purchaseLedger.idempotencyKey, idempotencyKey))
          .pipe(Effect.ignore);
        yield* db
          .delete(transactions)
          .where(eq(transactions.paymentProviderConfigurationProductId, providerProductId))
          .pipe(Effect.ignore);
        yield* db
          .delete(purchases)
          .where(eq(purchases.paymentProviderConfigurationProductId, providerProductId))
          .pipe(Effect.ignore);
        yield* db
          .delete(paymentProviderConfigurationProducts)
          .where(eq(paymentProviderConfigurationProducts.id, providerProductId))
          .pipe(Effect.ignore);
        yield* db
          .delete(paymentProviderConfigurations)
          .where(eq(paymentProviderConfigurations.id, configurationId))
          .pipe(Effect.ignore);
        yield* db.delete(products).where(eq(products.id, productId)).pipe(Effect.ignore);
        if (personId) {
          yield* db
            .delete(personExternalIdentifiers)
            .where(eq(personExternalIdentifiers.personId, personId))
            .pipe(Effect.ignore);
          yield* db
            .delete(personIdentities)
            .where(eq(personIdentities.personId, personId))
            .pipe(Effect.ignore);
          yield* db.delete(persons).where(eq(persons.id, personId)).pipe(Effect.ignore);
        }
      });

      yield* Effect.gen(function* () {
        yield* db.insert(products).values({
          id: productId,
          name: "Hermetic App Store lifetime",
          projectId,
          slug: productSlug,
        });
        yield* db.insert(paymentProviderConfigurations).values({
          configuration: {
            appAppleId: "1234567890",
            appStoreConnectApiIssuerId: "unused",
            appStoreConnectApiKeyId: "unused",
            appStoreConnectApiVendorNumber: "unused",
            appleServerNotificationForwardingUrl: "",
            appleSmallBusinessProgramHasEndDate: false,
            bundleId,
            inAppPurchaseKeyId: "unused",
            inAppPurchaseKeyIssuerId: "unused",
            inAppPurchasePrivateKey: "unused-by-hermetic-verifier",
            trackNewPurchasesFromAppleServerNotifications: true,
          },
          enabled: true,
          id: configurationId,
          name: "Hermetic App Store",
          paymentProviderKey: bundleId,
          projectId,
          providerId: "apple-app-store",
        });
        yield* db.insert(paymentProviderConfigurationProducts).values({
          configuration: { productId: providerProductKey },
          id: providerProductId,
          isActive: true,
          paymentProviderConfigurationId: configurationId,
          productId,
          providerProductKey,
        });

        const decodedTransaction = yield* decodeJWSTransactionDecodedPayload({
          appAccountToken: accountToken,
          bundleId,
          currency: "USD",
          environment: "Sandbox",
          originalPurchaseDate: purchasedAt,
          originalTransactionId: transactionId,
          price: 4990,
          productId: providerProductKey,
          purchaseDate: purchasedAt,
          signedDate: purchasedAt,
          storefront: "USA",
          transactionId,
          type: AppleTransactionType.NON_CONSUMABLE,
        });
        const verifierCalls: Array<{
          configurationId: string;
          transactionId: string;
        }> = [];
        const verifier = Layer.succeed(AppStoreTransactionVerifier, {
          verify: (input) => {
            verifierCalls.push({
              configurationId: input.configuration.id,
              transactionId: input.transactionId,
            });
            return Effect.succeed({
              decodedTransaction,
              providerEnvironment: ProviderEnvironment.Sandbox,
            });
          },
        });
        const serviceLayer = AppStorePaymentProviderServiceLive.pipe(
          Layer.provide(verifier),
          Layer.provide(AppStoreEngineLive),
        );
        const sdkLayer = SdkService.layer.pipe(
          Layer.provideMerge(
            Layer.mergeAll(
              PerkGrantService.layer,
              PurchaseService.layer,
              PersonIdentityService.layer.pipe(Layer.provide(IdentityProjectionPublisher.noop)),
              IdentityProjectionPublisher.noop,
              serviceLayer,
              googlePlayStub,
            ),
          ),
        );

        const httpApp = makePurchaseSdkHttpHandler(
          sdkLayer.pipe(Layer.provideMerge(Layer.succeed(Db, db))),
          sdkSession(distinctId),
        );
        disposeHttp = httpApp.dispose;
        const httpClient = HttpClient.make((request) =>
          Effect.gen(function* () {
            const webRequest = yield* HttpClientRequest.toWeb(request);
            const webResponse = yield* Effect.promise(() => httpApp.handler(webRequest));
            return HttpClientResponse.fromWeb(request, webResponse);
          }),
        );
        const generatedClient = makeGeneratedClient(httpClient, {
          transformClient: (client) =>
            Effect.succeed(
              client.pipe(
                HttpClient.mapRequest((request) =>
                  HttpClientRequest.prependUrl(request, "https://api.voidhash.test"),
                ),
              ),
            ),
        });
        const schema = {
          locations: {},
          perks: {},
          products: {
            [productSlug]: {
              configuration: {
                perks: {},
                providers: { appleAppStore: { productId: providerProductKey } },
              },
              properties: { name: "Hermetic App Store lifetime" },
              slug: productSlug,
              type: "one-time-non-consumable",
            },
          },
          version: "purchase-integration",
        } satisfies RuntimeSchema;
        const transaction = new ReactNativeTransaction(
          transactionId,
          transactionId,
          providerProductKey,
          purchasedAt,
          1,
          false,
          "ios",
          { appAccountToken: accountToken },
        );
        const assertPersistedBeforeFinish = () =>
          Effect.gen(function* () {
            const rows = yield* db
              .select()
              .from(purchaseLedger)
              .where(eq(purchaseLedger.idempotencyKey, idempotencyKey));
            expect(rows).toHaveLength(1);
          });
        let remainingNativeFailures = 1;
        const purchaseHarness = makeReactNativePurchaseHarness({
          client: generatedClient,
          distinctId,
          onAcknowledge: (_transaction, productType) =>
            Effect.gen(function* () {
              expect(productType).toBe("one-time-non-consumable");
              yield* assertPersistedBeforeFinish();
              if (remainingNativeFailures > 0) {
                remainingNativeFailures -= 1;
                return yield* new SimulatedNativeFailure({
                  message: "Simulated StoreKit finish failure",
                });
              }
            }),
          platform: { bundleId, platform: "ios" },
          syncTransactionShouldFailTimes: 1,
        });
        disposeReactNative.push(purchaseHarness.dispose);
        yield* Effect.promise(() => purchaseHarness.initialize);
        yield* Effect.promise(() =>
          expect(purchaseHarness.process(transaction, schema)).rejects.toThrow(
            "Simulated SDK transport failure",
          ),
        );
        expect(purchaseHarness.state.syncTransactionAttempts).toBe(1);
        expect(purchaseHarness.acknowledgedTransactions).toHaveLength(0);
        expect(verifierCalls).toHaveLength(0);

        // Both finalization attempts run concurrently, and both are expected to
        // reject (`Effect.promise` surfaces a rejection as a defect).
        const finalizationAttempts = yield* Effect.all(
          [
            Effect.exit(Effect.promise(() => purchaseHarness.process(transaction, schema))),
            Effect.exit(Effect.promise(() => purchaseHarness.process(transaction, schema))),
          ],
          { concurrency: "unbounded" },
        );
        expect(finalizationAttempts.map(Exit.isFailure)).toEqual([true, true]);
        expect(purchaseHarness.state.syncTransactionAttempts).toBe(2);
        expect(purchaseHarness.acknowledgedTransactions).toHaveLength(1);
        expect(verifierCalls).toHaveLength(1);

        yield* Effect.promise(() => purchaseHarness.process(transaction, schema));
        expect(purchaseHarness.state.syncTransactionAttempts).toBe(2);
        expect(purchaseHarness.state.personRefreshAttempts).toBe(1);
        expect(purchaseHarness.acknowledgedTransactions).toHaveLength(2);
        expect(verifierCalls).toHaveLength(1);

        const restoreHarness = makeReactNativePurchaseHarness({
          client: generatedClient,
          distinctId,
          onAcknowledge: (_transaction, productType) =>
            Effect.gen(function* () {
              expect(productType).toBe("one-time-non-consumable");
              yield* assertPersistedBeforeFinish();
            }),
          platform: { bundleId, platform: "ios" },
          purchaseHistory: [transaction],
        });
        disposeReactNative.push(restoreHarness.dispose);
        yield* Effect.promise(() => restoreHarness.initialize);
        yield* Effect.promise(() => restoreHarness.restore(schema));
        expect(restoreHarness.acknowledgedTransactions).toHaveLength(1);
        expect(restoreHarness.state.personRefreshAttempts).toBe(1);
        expect(verifierCalls).toEqual([
          { configurationId, transactionId },
          { configurationId, transactionId },
        ]);

        const purchaseRows = yield* db
          .select()
          .from(purchases)
          .where(eq(purchases.paymentProviderConfigurationProductId, providerProductId));
        const ledgerRows = yield* db
          .select()
          .from(purchaseLedger)
          .where(eq(purchaseLedger.idempotencyKey, idempotencyKey));
        const accountBinding = yield* db.query.personExternalIdentifiers.findFirst({
          where: {
            identifier: accountToken,
            projectId,
            serviceId: "voidhash-account-token",
          },
        });
        const identity = yield* db.query.personIdentities.findFirst({
          where: { distinctId, projectId },
        });
        personId = identity?.personId;

        expect(purchaseRows).toHaveLength(1);
        expect(personId).toBeDefined();
        expect(purchaseRows[0]?.personId).toBe(personId);
        expect(purchaseRows[0]?.providerEnvironment).toBe(ProviderEnvironment.Sandbox);
        expect(ledgerRows).toHaveLength(1);
        expect(ledgerRows[0]?.source).toBe("sdk");
        expect(accountBinding?.personId).toBe(personId);
        expect(identity?.personId).toBe(personId);
      }).pipe(Effect.ensuring(cleanup));
    }).pipe(CoreAuthSession.authenticate()),
  );

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
          receivedAt: nowDate(),
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
