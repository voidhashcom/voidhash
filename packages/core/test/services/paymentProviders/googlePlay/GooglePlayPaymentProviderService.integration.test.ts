import { Effect, Layer, Option } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http";
import { describe, expect } from "vitest";

import {
  AppStorePaymentProviderService,
  FxRateService,
  GooglePlayPaymentProviderServiceLive,
  GooglePlayPurchaseVerifier,
  IdentityProjectionPublisher,
  PerkGrantService,
  PersonIdentityService,
  PurchaseProcessingService,
  PurchaseService,
  SdkService,
} from "@voidhash/core/services";
import type { PublishableKeySession } from "@voidhash/core/domain/auth/Auth";
import { GooglePlayPaymentProvider } from "@voidhash/core/services/paymentProviders/googlePlay/payment-provider";
import { GooglePlayServerApi } from "@voidhash/core/services/paymentProviders/googlePlay/sdk-context";
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
let sequence = 0;
const unique = (label: string) => `it-gp-sdk-${label}-${Date.now()}-${sequence++}`;

const appStoreStub = Layer.succeed(AppStorePaymentProviderService, {
  acceptServerNotification: () => Effect.die("App Store webhook must not run"),
  processSdkTransaction: () => Effect.die("App Store purchase must not run"),
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

const GooglePlayEngineLive = GooglePlayPaymentProvider.layer.pipe(
  Layer.provideMerge(
    Layer.mergeAll(
      PurchaseProcessingService.layer,
      PersonIdentityService.layer,
      FxRateService.layer({ apiKey: Effect.succeed("test-fx-key") }),
      PaymentConfigSecretCrypto.layer({ key: Effect.succeed("") }),
      GooglePlayServerApi.layer,
    ),
  ),
  Layer.provideMerge(Layer.mergeAll(PerkGrantService.layer, IdentityProjectionPublisher.noop)),
);

describe("GooglePlayPaymentProviderService.processSdkTransaction", () => {
  test(
    "runs purchase, retry, restore, verification, and persistence end to end",
    Effect.gen(function* () {
      const db = yield* Db;
      const distinctId = unique("person");
      const accountToken = yield* deriveAccountToken(distinctId);
      const packageName = `com.voidhash.${unique("package").replaceAll("-", "")}`;
      const providerProductKey = unique("coins");
      const productSlug = unique("coins-slug");
      const purchaseToken = unique("token");
      const orderId = unique("order");
      const configurationId = generateId("paymentProviderConfiguration");
      const providerProductId = generateId("paymentProviderProduct");
      const productId = generateId("product");
      const receivedAt = new Date();
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
          .where(eq(purchaseLedger.idempotencyKey, `google:${orderId}:one_time_purchase`))
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
          name: "Hermetic Google Play coins",
          projectId,
          slug: productSlug,
        });
        yield* db.insert(paymentProviderConfigurations).values({
          configuration: {
            googleRealTimeDeveloperNotificationForwardingUrl: "",
            googleRealTimeDeveloperNotificationTopicName: "",
            packageName,
            serviceAccountKey: "unused-by-hermetic-verifier",
          },
          enabled: true,
          id: configurationId,
          name: "Hermetic Google Play",
          paymentProviderKey: packageName,
          projectId,
          providerId: "google-play",
        });
        yield* db.insert(paymentProviderConfigurationProducts).values({
          configuration: { productId: providerProductKey },
          id: providerProductId,
          isActive: true,
          paymentProviderConfigurationId: configurationId,
          productId,
          providerProductKey,
        });

        const verifierCalls: Array<{
          configurationId: string;
          productId: string;
          purchaseToken: string;
        }> = [];
        const verifier = Layer.succeed(GooglePlayPurchaseVerifier, {
          verify: (input) => {
            verifierCalls.push({
              configurationId: input.configuration.id,
              productId: input.productId,
              purchaseToken: input.purchaseToken,
            });
            return Effect.succeed({
              providerEnvironment: ProviderEnvironment.Sandbox,
              purchase: {
                acknowledgementState: Option.some("ACKNOWLEDGEMENT_STATE_PENDING"),
                autoRenewEnabled: false,
                basePlanId: Option.none(),
                currency: Option.none(),
                expiryTime: Option.none(),
                isTrial: false,
                kind: "product" as const,
                linkedPurchaseToken: Option.none(),
                obfuscatedExternalAccountId: Option.some(accountToken),
                offerId: Option.none(),
                orderId: Option.some(orderId),
                priceMinorUnits: Option.none(),
                productId: providerProductKey,
                purchaseToken,
                startTime: Option.some(receivedAt),
                storefront: Option.some("US"),
                subscriptionState: Option.none(),
              },
            });
          },
        });
        const serviceLayer = GooglePlayPaymentProviderServiceLive.pipe(
          Layer.provide(verifier),
          Layer.provide(GooglePlayEngineLive),
        );
        const sdkLayer = SdkService.layer.pipe(
          Layer.provideMerge(
            Layer.mergeAll(
              PerkGrantService.layer,
              PurchaseService.layer,
              PersonIdentityService.layer.pipe(Layer.provide(IdentityProjectionPublisher.noop)),
              IdentityProjectionPublisher.noop,
              serviceLayer,
              appStoreStub,
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
                providers: { googlePlay: { productId: providerProductKey } },
              },
              properties: { name: "Hermetic Google Play lifetime" },
              slug: productSlug,
              type: "one-time-non-consumable",
            },
          },
          version: "purchase-integration",
        } satisfies RuntimeSchema;
        const transaction = new ReactNativeTransaction(
          purchaseToken,
          orderId,
          providerProductKey,
          receivedAt.getTime(),
          1,
          false,
          "android",
          { appAccountToken: accountToken, purchaseToken },
        );
        const assertPersistedBeforeAcknowledge = () =>
          Effect.gen(function* () {
            const rows = yield* db
              .select()
              .from(purchaseLedger)
              .where(eq(purchaseLedger.idempotencyKey, `google:${orderId}:one_time_purchase`));
            expect(rows).toHaveLength(1);
          });
        let remainingNativeFailures = 1;
        const purchaseHarness = makeReactNativePurchaseHarness({
          client: generatedClient,
          distinctId,
          onAcknowledge: (_transaction, productType) =>
            Effect.gen(function* () {
              expect(productType).toBe("one-time-non-consumable");
              yield* assertPersistedBeforeAcknowledge();
              if (remainingNativeFailures > 0) {
                remainingNativeFailures -= 1;
                return yield* Effect.fail(new Error("Simulated Google acknowledgement failure"));
              }
            }),
          platform: { bundleId: packageName, platform: "android" },
          syncTransactionShouldFailTimes: 1,
        });
        disposeReactNative.push(purchaseHarness.dispose);
        yield* Effect.promise(async () => {
          await purchaseHarness.initialize;
          await expect(purchaseHarness.process(transaction, schema)).rejects.toThrow(
            "Simulated SDK transport failure",
          );
          expect(purchaseHarness.state.syncTransactionAttempts).toBe(1);
          expect(purchaseHarness.acknowledgedTransactions).toHaveLength(0);
          expect(verifierCalls).toHaveLength(0);

          const finalizationAttempts = await Promise.allSettled([
            purchaseHarness.process(transaction, schema),
            purchaseHarness.process(transaction, schema),
          ]);
          expect(finalizationAttempts.map((result) => result.status)).toEqual([
            "rejected",
            "rejected",
          ]);
          expect(purchaseHarness.state.syncTransactionAttempts).toBe(2);
          expect(purchaseHarness.acknowledgedTransactions).toHaveLength(1);
          expect(verifierCalls).toHaveLength(1);

          await purchaseHarness.process(transaction, schema);
        });
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
              yield* assertPersistedBeforeAcknowledge();
            }),
          platform: { bundleId: packageName, platform: "android" },
          purchaseHistory: [transaction],
        });
        disposeReactNative.push(restoreHarness.dispose);
        yield* Effect.promise(async () => {
          await restoreHarness.initialize;
          await restoreHarness.restore(schema);
        });
        expect(restoreHarness.acknowledgedTransactions).toHaveLength(1);
        expect(restoreHarness.state.personRefreshAttempts).toBe(1);
        expect(verifierCalls).toEqual([
          { configurationId, productId: providerProductKey, purchaseToken },
          { configurationId, productId: providerProductKey, purchaseToken },
        ]);

        const purchaseRows = yield* db
          .select()
          .from(purchases)
          .where(eq(purchases.paymentProviderConfigurationProductId, providerProductId));
        const ledgerRows = yield* db
          .select()
          .from(purchaseLedger)
          .where(eq(purchaseLedger.idempotencyKey, `google:${orderId}:one_time_purchase`));
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
});
