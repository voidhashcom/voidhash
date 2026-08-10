/**
 * Integration tests for the Google Play record engine
 * ({@link GooglePlayPaymentProvider}), run against the real backend stack
 * provisioned once by `test/_testing/globalSetup.ts` (live PlanetScale DB +
 * PostgreSQL; only the project schema cache is an in-memory stub).
 *
 * The engine's `record*` methods consume an already-normalized purchase (the
 * Google analogue of App Store's decoded JWS), so these tests build synthetic
 * {@link GooglePlayNormalizedPurchase} values in-process and never call the
 * live Play Developer API. They drive the whole DB graph end-to-end and verify
 * the persisted side effects (identity rows, operational projection,
 * `purchase_ledger`), mirroring the App Store engine integration suite.
 *
 * Paths that DO require the live Play API (`buildSdkContextFromConfiguration`,
 * `fetchAndNormalize*`, and therefore the RTDN webhook handler) are deferred to
 * `test.todo` — minting an OAuth2 token + fetching a purchase needs real
 * service-account credentials that aren't available offline.
 */
import { DateTime, Effect, Layer, Option } from "effect";
import { describe, expect, test as vitestTest } from "vitest";

import {
  FxRateService,
  GooglePlayServerApi,
  IdentityProjectionPublisher,
  PerkGrantService,
  PersonIdentityService,
  PurchaseProcessingService,
} from "@voidhash/core/services";
import {
  type GooglePlayRecordInput,
  GooglePlayPaymentProvider,
} from "@voidhash/core/services/paymentProviders/googlePlay/payment-provider";
import { PaymentConfigSecretCrypto } from "@voidhash/core/utils/crypto/PaymentConfigSecretCrypto";
import {
  ACCOUNT_TOKEN_SERVICE_ID,
  deriveAccountToken,
} from "@voidhash/core/utils/crypto/account-token";
import { generateId } from "@voidhash/core/utils";
import {
  GooglePlayPaymentProviderProductNotMappedError,
  GooglePlayPaymentProviderSdkTransactionMissingDistinctIdError,
  GooglePlayPurchaseProcessingIdempotencyKeyDerivationError,
} from "../../../../src/services/paymentProviders/googlePlay/errors.ts";
import type { GooglePlayNormalizedPurchase } from "../../../../src/services/paymentProviders/googlePlay/helpers.ts";
import {
  type Project as DbProject,
  Db,
  PersonOrigin,
  ProviderEnvironment,
  and,
  eq,
  inArray,
  paymentProviderConfigurationProducts,
  paymentProviderConfigurations,
  personExternalIdentifiers,
  personIdentities,
  persons,
  products,
  purchaseLedger,
  purchases,
  subscriptions,
  transactions,
} from "@voidhash/db";

import { CoreAuthSession } from "@testing/CoreAuthSession";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";
import { CoreTestFixture } from "@testing/CoreTestFixture";

const { test } = CoreIntegrationTestHarness.make();

const projectId = CoreTestFixture.projectId;

/** Wall-clock "now" as a `Date`, read through Effect's clock. */
const nowDate = (): Date => Effect.runSync(DateTime.nowAsDate);

/** Builds a `Date` from epoch milliseconds without touching the `Date` constructor. */
const dateFromMillis = (millis: number): Date => DateTime.toDateUtc(DateTime.makeUnsafe(millis));

let seq = 0;
const uniq = (label: string) => `it-gp-${label}-${nowDate().getTime()}-${seq++}`;

/**
 * Full dependency graph for the Google Play record engine. Everything is either
 * a real `Db`-backed service or a leaf stub, so the only escaping requirements
 * are the harness `Db` and the per-test `AuthSession`.
 */
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

// ----------------------------------------------------------------------------
// DB read-back helpers (bypass the engine).
// ----------------------------------------------------------------------------

const findConfiguration = (id: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.paymentProviderConfigurations.findFirst({
      where: { id },
    });
  });

const findExternalIdentifier = (identifier: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.personExternalIdentifiers.findFirst({
      where: {
        projectId,
        serviceId: "google-play",
        identifier,
      },
    });
  });

const findSubscriptionByStoreId = (storeSubscriptionId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.subscriptions.findFirst({
      where: { storeSubscriptionId },
    });
  });

const findPurchaseByProviderKey = (providerKey: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.purchases.findFirst({ where: { providerKey } });
  });

const findLedgerByKey = (idempotencyKey: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.purchaseLedger.findFirst({
      where: { idempotencyKey },
    });
  });

// ----------------------------------------------------------------------------
// Synthetic normalized-purchase builders.
// ----------------------------------------------------------------------------

const baseFields = (): Omit<GooglePlayNormalizedPurchase, "kind" | "productId"> => ({
  acknowledgementState: Option.some("ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED"),
  autoRenewEnabled: true,
  basePlanId: Option.none(),
  currency: Option.none(),
  expiryTime: Option.some(dateFromMillis(nowDate().getTime() + 30 * 24 * 60 * 60 * 1000)),
  isTrial: false,
  linkedPurchaseToken: Option.none(),
  obfuscatedExternalAccountId: Option.none(),
  offerId: Option.none(),
  orderId: Option.some(uniq("order")),
  priceMinorUnits: Option.none(),
  purchaseToken: uniq("token"),
  startTime: Option.some(nowDate()),
  storefront: Option.some("US"),
  subscriptionState: Option.some("SUBSCRIPTION_STATE_ACTIVE"),
});

const subPurchase = (
  overrides: Partial<GooglePlayNormalizedPurchase> = {},
): GooglePlayNormalizedPurchase => ({
  ...baseFields(),
  kind: "subscription",
  productId: "premium",
  ...overrides,
});

const productPurchase = (
  overrides: Partial<GooglePlayNormalizedPurchase> = {},
): GooglePlayNormalizedPurchase => ({
  ...baseFields(),
  autoRenewEnabled: false,
  expiryTime: Option.none(),
  kind: "product",
  productId: "coins_100",
  subscriptionState: Option.none(),
  ...overrides,
});

// ----------------------------------------------------------------------------
// Per-test parent-row seeding + cleanup.
// ----------------------------------------------------------------------------

interface CleanupTrack {
  readonly configIds: string[];
  readonly providerProductIds: string[];
  readonly productIds: string[];
  readonly ledgerKeys: string[];
  readonly subscriptionStoreIds: string[];
  readonly purchaseProviderKeys: string[];
  readonly externalIdentifiers: string[];
}

const newTrack = (): CleanupTrack => ({
  configIds: [],
  externalIdentifiers: [],
  ledgerKeys: [],
  productIds: [],
  providerProductIds: [],
  purchaseProviderKeys: [],
  subscriptionStoreIds: [],
});

const seedConfig = (track: CleanupTrack, label: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const configId = generateId("paymentProviderConfiguration");
    const providerProductId = generateId("paymentProviderProduct");
    const productId = generateId("product");
    const productKey = uniq(`${label}-prod`);
    const packageName = `com.example.${label.replace(/[^a-z0-9]/gi, "")}${seq}`;

    track.configIds.push(configId);
    track.providerProductIds.push(providerProductId);
    track.productIds.push(productId);

    yield* db.insert(products).values({
      id: productId,
      name: `GooglePlay IT ${label}`,
      projectId,
      slug: uniq(`${label}-slug`),
    });
    yield* db.insert(paymentProviderConfigurations).values({
      configuration: {
        googleRealTimeDeveloperNotificationForwardingUrl: "",
        googleRealTimeDeveloperNotificationTopicName: "",
        packageName,
        serviceAccountKey: "PLAINTEXT_KEY",
      },
      enabled: true,
      id: configId,
      name: `GooglePlay IT ${label}`,
      paymentProviderKey: packageName,
      projectId,
      providerId: "google-play",
    });
    yield* db.insert(paymentProviderConfigurationProducts).values({
      configuration: { productId: productKey },
      id: providerProductId,
      isActive: true,
      paymentProviderConfigurationId: configId,
      productId,
      providerProductKey: productKey,
    });

    const configuration = yield* findConfiguration(configId);
    if (configuration === undefined) {
      return yield* Effect.die(new Error(`seeded payment provider configuration ${configId} not found`));
    }
    return {
      configuration,
      packageName,
      productKey,
      providerProductId,
      productId,
    };
  });

const cleanup = (track: CleanupTrack) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const ignore = <A, E>(eff: Effect.Effect<A, E, never>) => eff.pipe(Effect.ignore);

    if (track.ledgerKeys.length > 0) {
      yield* ignore(
        db.delete(purchaseLedger).where(inArray(purchaseLedger.idempotencyKey, track.ledgerKeys)),
      );
    }
    if (track.subscriptionStoreIds.length > 0) {
      yield* ignore(
        db
          .delete(subscriptions)
          .where(inArray(subscriptions.storeSubscriptionId, track.subscriptionStoreIds)),
      );
    }
    if (track.purchaseProviderKeys.length > 0) {
      yield* ignore(
        db.delete(purchases).where(inArray(purchases.providerKey, track.purchaseProviderKeys)),
      );
    }
    if (track.providerProductIds.length > 0) {
      yield* ignore(
        db
          .delete(transactions)
          .where(
            inArray(transactions.paymentProviderConfigurationProductId, track.providerProductIds),
          ),
      );
      yield* ignore(
        db
          .delete(subscriptions)
          .where(
            inArray(subscriptions.paymentProviderConfigurationProductId, track.providerProductIds),
          ),
      );
      yield* ignore(
        db
          .delete(purchases)
          .where(
            inArray(purchases.paymentProviderConfigurationProductId, track.providerProductIds),
          ),
      );
      yield* ignore(
        db
          .delete(paymentProviderConfigurationProducts)
          .where(inArray(paymentProviderConfigurationProducts.id, track.providerProductIds)),
      );
    }
    if (track.configIds.length > 0) {
      yield* ignore(
        db
          .delete(paymentProviderConfigurations)
          .where(inArray(paymentProviderConfigurations.id, track.configIds)),
      );
    }
    if (track.productIds.length > 0) {
      yield* ignore(db.delete(products).where(inArray(products.id, track.productIds)));
    }
    if (track.externalIdentifiers.length > 0) {
      const extRows = yield* db
        .select({
          id: personExternalIdentifiers.id,
          personId: personExternalIdentifiers.personId,
        })
        .from(personExternalIdentifiers)
        .where(
          and(
            eq(personExternalIdentifiers.projectId, projectId),
            inArray(personExternalIdentifiers.identifier, track.externalIdentifiers),
          ),
        )
        .pipe(Effect.orElseSucceed((): { id: string; personId: string }[] => []));
      const personIds = [...new Set(extRows.map((r) => r.personId))];
      yield* ignore(
        db
          .delete(personExternalIdentifiers)
          .where(
            and(
              eq(personExternalIdentifiers.projectId, projectId),
              inArray(personExternalIdentifiers.identifier, track.externalIdentifiers),
            ),
          ),
      );
      if (personIds.length > 0) {
        yield* ignore(
          db.delete(personIdentities).where(inArray(personIdentities.personId, personIds)),
        );
        yield* ignore(db.delete(persons).where(inArray(persons.id, personIds)));
      }
    }
  });

/**
 * Unchecked predicate used by the "SDK source without a distinctId" test to hand
 * the engine an input the discriminated union forbids at the type level. It always
 * holds; it exists only so the type-boundary crossing is confined to one place.
 */
const isRecordInput = (value: object): value is GooglePlayRecordInput => value !== null;

const withEngine = <E, R>(
  body: (args: {
    readonly project: DbProject;
    readonly track: CleanupTrack;
  }) => Effect.Effect<void, E, R>,
): Effect.Effect<void, E, R | Db> => {
  const track = newTrack();
  return Effect.gen(function* () {
    const db = yield* Db;
    const project = yield* db.query.projects
      .findFirst({ where: { id: projectId } })
      .pipe(Effect.orDie);
    if (project === undefined) {
      return yield* Effect.die(new Error(`fixture project ${projectId} not found`));
    }
    return yield* body({ project, track });
  }).pipe(Effect.ensuring(cleanup(track)));
};

describe("GooglePlayPaymentProvider.recordPurchase", () => {
  test(
    "subscription initial buy routes to startSubscription and persists subscription + ledger",
    withEngine(({ project, track }) =>
      Effect.gen(function* () {
        const engine = yield* GooglePlayPaymentProvider;
        const seeded = yield* seedConfig(track, "sub-initial");
        const purchase = subPurchase({
          obfuscatedExternalAccountId: Option.some(uniq("acct")),
          productId: seeded.productKey,
        });
        track.subscriptionStoreIds.push(purchase.purchaseToken);
        track.externalIdentifiers.push(Option.getOrThrow(purchase.obfuscatedExternalAccountId));
        const orderId = Option.getOrThrow(purchase.orderId);
        track.ledgerKeys.push(`google:${orderId}:purchase`);

        const result = yield* engine.recordPurchase({
          configuration: seeded.configuration,
          distinctId: uniq("distinct"),
          eventTime: nowDate(),
          project,
          providerEnvironment: ProviderEnvironment.Production,
          purchase,
          receivedAt: nowDate(),
          source: "sdk",
        });

        expect(Option.isSome(result.subscriptionId)).toBe(true);
        expect(result.personId.length).toBeGreaterThan(0);
        expect(result.idempotent).toBe(false);

        const subRow = yield* findSubscriptionByStoreId(purchase.purchaseToken);
        expect(subRow).toBeDefined();
        expect(subRow?.paymentProviderConfigurationProductId).toBe(seeded.providerProductId);
        expect(subRow?.personId).toBe(result.personId);

        const ledger = yield* findLedgerByKey(`google:${orderId}:purchase`);
        expect(ledger).toBeDefined();
        expect(ledger?.providerId).toBe("google-play");
        expect(ledger?.providerEventType).toBe("purchase");
        expect(ledger?.source).toBe("sdk");
      }),
    ).pipe(Effect.provide(GooglePlayEngineLive), CoreAuthSession.authenticate()),
  );

  test(
    "SDK source with obfuscatedExternalAccountId = deriveAccountToken(distinctId) registers a voidhash-account-token binding",
    withEngine(({ project, track }) =>
      Effect.gen(function* () {
        const engine = yield* GooglePlayPaymentProvider;
        const seeded = yield* seedConfig(track, "token-binding");
        const distinctId = uniq("distinct");
        const token = yield* deriveAccountToken(distinctId);
        const purchase = subPurchase({
          obfuscatedExternalAccountId: Option.some(token),
          productId: seeded.productKey,
        });
        track.subscriptionStoreIds.push(purchase.purchaseToken);
        track.externalIdentifiers.push(token);
        track.ledgerKeys.push(`google:${Option.getOrThrow(purchase.orderId)}:purchase`);

        const result = yield* engine.recordPurchase({
          configuration: seeded.configuration,
          distinctId,
          eventTime: nowDate(),
          project,
          providerEnvironment: ProviderEnvironment.Production,
          purchase,
          receivedAt: nowDate(),
          source: "sdk",
        });

        const db = yield* Db;
        const binding = yield* db.query.personExternalIdentifiers.findFirst({
          where: {
            projectId,
            serviceId: ACCOUNT_TOKEN_SERVICE_ID,
            identifier: token,
          },
        });
        expect(binding).toBeDefined();
        expect(binding?.personId).toBe(result.personId);
      }),
    ).pipe(Effect.provide(GooglePlayEngineLive), CoreAuthSession.authenticate()),
  );

  test(
    "SDK source with a foreign account token (not derived from distinctId) writes no account-token binding",
    withEngine(({ project, track }) =>
      Effect.gen(function* () {
        const engine = yield* GooglePlayPaymentProvider;
        const seeded = yield* seedConfig(track, "foreign-token");
        const foreignToken = yield* deriveAccountToken(uniq("other-person"));
        const purchase = subPurchase({
          obfuscatedExternalAccountId: Option.some(foreignToken),
          productId: seeded.productKey,
        });
        track.subscriptionStoreIds.push(purchase.purchaseToken);
        track.externalIdentifiers.push(foreignToken);
        track.ledgerKeys.push(`google:${Option.getOrThrow(purchase.orderId)}:purchase`);

        yield* engine.recordPurchase({
          configuration: seeded.configuration,
          distinctId: uniq("distinct"),
          eventTime: nowDate(),
          project,
          providerEnvironment: ProviderEnvironment.Production,
          purchase,
          receivedAt: nowDate(),
          source: "sdk",
        });

        const db = yield* Db;
        const binding = yield* db.query.personExternalIdentifiers.findFirst({
          where: {
            projectId,
            serviceId: ACCOUNT_TOKEN_SERVICE_ID,
            identifier: foreignToken,
          },
        });
        expect(binding).toBeUndefined();
      }),
    ).pipe(Effect.provide(GooglePlayEngineLive), CoreAuthSession.authenticate()),
  );

  test(
    "one-time product purchase routes to completeOneTimePurchase and persists a purchase row",
    withEngine(({ project, track }) =>
      Effect.gen(function* () {
        const engine = yield* GooglePlayPaymentProvider;
        const seeded = yield* seedConfig(track, "one-time");
        const purchase = productPurchase({
          obfuscatedExternalAccountId: Option.some(uniq("acct")),
          productId: seeded.productKey,
        });
        const orderId = Option.getOrThrow(purchase.orderId);
        track.purchaseProviderKeys.push(orderId);
        track.externalIdentifiers.push(Option.getOrThrow(purchase.obfuscatedExternalAccountId));
        track.ledgerKeys.push(`google:${orderId}:one_time_purchase`);

        const result = yield* engine.recordPurchase({
          configuration: seeded.configuration,
          distinctId: uniq("distinct"),
          eventTime: nowDate(),
          project,
          providerEnvironment: ProviderEnvironment.Production,
          purchase,
          receivedAt: nowDate(),
          source: "sdk",
        });

        expect(Option.isNone(result.subscriptionId)).toBe(true);
        const purchaseRow = yield* findPurchaseByProviderKey(orderId);
        expect(purchaseRow).toBeDefined();
        expect(purchaseRow?.personId).toBe(result.personId);
      }),
    ).pipe(Effect.provide(GooglePlayEngineLive), CoreAuthSession.authenticate()),
  );

  test(
    "webhook path without distinctId resolves a stand-in person stamped GooglePlayWebhook",
    withEngine(({ project, track }) =>
      Effect.gen(function* () {
        const engine = yield* GooglePlayPaymentProvider;
        const seeded = yield* seedConfig(track, "webhook-standin");
        // No account token / orderId → personIdentifier falls back to purchaseToken.
        const purchase = subPurchase({ orderId: Option.none(), productId: seeded.productKey });
        track.subscriptionStoreIds.push(purchase.purchaseToken);
        track.externalIdentifiers.push(purchase.purchaseToken);
        track.ledgerKeys.push(
          `google:${purchase.purchaseToken}:purchase`, // orderId none → key would fail; see below
        );

        // orderId is required for the purchase idempotency key, so give the
        // webhook purchase an order id but a purchaseToken-based personIdentifier
        // by leaving the account token + orderId-as-identifier path: set orderId.
        const withOrder = subPurchase({
          obfuscatedExternalAccountId: Option.none(),
          orderId: Option.some(uniq("order")),
          productId: seeded.productKey,
          purchaseToken: purchase.purchaseToken,
        });
        track.ledgerKeys.push(`google:${Option.getOrThrow(withOrder.orderId)}:purchase`);
        // personIdentifier = orderId (no account token) for the webhook path.
        track.externalIdentifiers.push(Option.getOrThrow(withOrder.orderId));

        const result = yield* engine.recordPurchase({
          configuration: seeded.configuration,
          eventTime: nowDate(),
          project,
          providerEnvironment: ProviderEnvironment.Production,
          purchase: withOrder,
          receivedAt: nowDate(),
          source: "webhook",
        });

        const ext = yield* findExternalIdentifier(Option.getOrThrow(withOrder.orderId));
        expect(ext).toBeDefined();
        expect(ext?.personId).toBe(result.personId);

        const db = yield* Db;
        const personRow = yield* db.query.persons.findFirst({
          where: { id: result.personId },
        });
        expect(personRow?.origin).toBe(PersonOrigin.GooglePlayWebhook);
      }),
    ).pipe(Effect.provide(GooglePlayEngineLive), CoreAuthSession.authenticate()),
  );

  test(
    "missing productId returns an ignored result and writes no operational rows",
    withEngine(({ project, track }) =>
      Effect.gen(function* () {
        const engine = yield* GooglePlayPaymentProvider;
        const seeded = yield* seedConfig(track, "ignored");
        const purchase = subPurchase({ productId: "" });

        const result = yield* engine.recordPurchase({
          configuration: seeded.configuration,
          eventTime: nowDate(),
          project,
          providerEnvironment: ProviderEnvironment.Production,
          purchase,
          receivedAt: nowDate(),
          source: "webhook",
        });

        expect(result.idempotent).toBe(true);
        expect(result.personId).toBe("");
        expect(Option.isNone(result.subscriptionId)).toBe(true);

        const subRow = yield* findSubscriptionByStoreId(purchase.purchaseToken);
        expect(subRow).toBeUndefined();
      }),
    ).pipe(Effect.provide(GooglePlayEngineLive), CoreAuthSession.authenticate()),
  );

  test(
    "unmapped productId fails with GooglePlayPaymentProviderProductNotMappedError and writes nothing",
    withEngine(({ project, track }) =>
      Effect.gen(function* () {
        const engine = yield* GooglePlayPaymentProvider;
        const seeded = yield* seedConfig(track, "not-mapped");
        const unmappedKey = uniq("unmapped");
        const purchase = subPurchase({
          orderId: Option.some(uniq("order")),
          productId: unmappedKey,
        });
        // identity is resolved (personIdentifier = orderId) before the mapping check.
        track.externalIdentifiers.push(Option.getOrThrow(purchase.orderId));

        const error = yield* Effect.flip(
          engine.recordPurchase({
            configuration: seeded.configuration,
            eventTime: nowDate(),
            project,
            providerEnvironment: ProviderEnvironment.Production,
            purchase,
            receivedAt: nowDate(),
            source: "webhook",
          }),
        );
        expect(error).toBeInstanceOf(GooglePlayPaymentProviderProductNotMappedError);
        if (error instanceof GooglePlayPaymentProviderProductNotMappedError) {
          expect(error.providerProductKey).toBe(unmappedKey);
          expect(error.paymentProviderConfigurationId).toBe(seeded.configuration.id);
        }

        const subRow = yield* findSubscriptionByStoreId(purchase.purchaseToken);
        expect(subRow).toBeUndefined();
      }),
    ).pipe(Effect.provide(GooglePlayEngineLive), CoreAuthSession.authenticate()),
  );

  test(
    "SDK source without a distinctId fails with SdkTransactionMissingDistinctIdError",
    withEngine(({ project, track }) =>
      Effect.gen(function* () {
        const engine = yield* GooglePlayPaymentProvider;
        const seeded = yield* seedConfig(track, "no-distinct");
        const purchase = subPurchase({ productId: seeded.productKey });

        const input = {
          configuration: seeded.configuration,
          distinctId: undefined,
          eventTime: nowDate(),
          project,
          providerEnvironment: ProviderEnvironment.Production,
          purchase,
          receivedAt: nowDate(),
          source: "sdk",
        };
        // The `sdk` branch of `GooglePlayRecordInput` demands a `distinctId` at the
        // type level; this test exercises the runtime guard behind it, so the value
        // crosses the type boundary through a single unchecked predicate.
        if (!isRecordInput(input)) {
          return yield* Effect.die(new Error("unreachable: isRecordInput always holds"));
        }

        const error = yield* Effect.flip(engine.recordPurchase(input));
        expect(error).toBeInstanceOf(GooglePlayPaymentProviderSdkTransactionMissingDistinctIdError);
      }),
    ).pipe(Effect.provide(GooglePlayEngineLive), CoreAuthSession.authenticate()),
  );

  test(
    "a purchase missing its orderId anchor fails with IdempotencyKeyDerivationError and writes nothing",
    withEngine(({ project, track }) =>
      Effect.gen(function* () {
        const engine = yield* GooglePlayPaymentProvider;
        const seeded = yield* seedConfig(track, "idemp-fail");
        // No orderId → personIdentifier falls back to purchaseToken (identity is
        // still resolved before key derivation), and the purchase key fails.
        const purchase = subPurchase({ orderId: Option.none(), productId: seeded.productKey });
        track.externalIdentifiers.push(purchase.purchaseToken);

        const error = yield* Effect.flip(
          engine.recordPurchase({
            configuration: seeded.configuration,
            eventTime: nowDate(),
            project,
            providerEnvironment: ProviderEnvironment.Production,
            purchase,
            receivedAt: nowDate(),
            source: "webhook",
          }),
        );
        expect(error).toBeInstanceOf(GooglePlayPurchaseProcessingIdempotencyKeyDerivationError);
        if (error instanceof GooglePlayPurchaseProcessingIdempotencyKeyDerivationError) {
          expect(error.missingField).toBe("orderId");
        }

        const subRow = yield* findSubscriptionByStoreId(purchase.purchaseToken);
        expect(subRow).toBeUndefined();
      }),
    ).pipe(Effect.provide(GooglePlayEngineLive), CoreAuthSession.authenticate()),
  );

  test(
    "duplicate delivery of the same logical event returns an idempotent result (ledger UNIQUE gate)",
    withEngine(({ project, track }) =>
      Effect.gen(function* () {
        const engine = yield* GooglePlayPaymentProvider;
        const seeded = yield* seedConfig(track, "idempotent");
        const purchase = subPurchase({
          obfuscatedExternalAccountId: Option.some(uniq("acct")),
          productId: seeded.productKey,
        });
        track.subscriptionStoreIds.push(purchase.purchaseToken);
        track.externalIdentifiers.push(Option.getOrThrow(purchase.obfuscatedExternalAccountId));
        track.ledgerKeys.push(`google:${Option.getOrThrow(purchase.orderId)}:purchase`);

        const input: GooglePlayRecordInput = {
          configuration: seeded.configuration,
          distinctId: uniq("distinct"),
          eventTime: nowDate(),
          project,
          providerEnvironment: ProviderEnvironment.Production,
          purchase,
          receivedAt: nowDate(),
          source: "sdk",
        };

        const first = yield* engine.recordPurchase(input);
        expect(first.idempotent).toBe(false);
        const second = yield* engine.recordPurchase(input);
        expect(second.idempotent).toBe(true);
        expect(Option.getOrNull(second.subscriptionId)).toBe(
          Option.getOrNull(first.subscriptionId),
        );
      }),
    ).pipe(Effect.provide(GooglePlayEngineLive), CoreAuthSession.authenticate()),
  );
});

describe("GooglePlayPaymentProvider lifecycle record* routing", () => {
  /** Seeds a live subscription one hour earlier so follow-up events pass the watermark. */
  const seedActiveSubscription = (track: CleanupTrack, project: DbProject, label: string) =>
    Effect.gen(function* () {
      const engine = yield* GooglePlayPaymentProvider;
      const seeded = yield* seedConfig(track, label);
      const purchase = subPurchase({
        obfuscatedExternalAccountId: Option.some(uniq("acct")),
        productId: seeded.productKey,
      });
      track.subscriptionStoreIds.push(purchase.purchaseToken);
      track.externalIdentifiers.push(Option.getOrThrow(purchase.obfuscatedExternalAccountId));
      track.ledgerKeys.push(`google:${Option.getOrThrow(purchase.orderId)}:purchase`);

      yield* engine.recordPurchase({
        configuration: seeded.configuration,
        distinctId: uniq("distinct"),
        eventTime: dateFromMillis(nowDate().getTime() - 60 * 60 * 1000),
        project,
        providerEnvironment: ProviderEnvironment.Production,
        purchase,
        receivedAt: nowDate(),
        source: "sdk",
      });
      const expiryMs = Option.getOrThrow(purchase.expiryTime).getTime();
      return { expiryMs, purchase, seeded };
    });

  test(
    "recordSubscriptionExpired marks the subscription expired and writes an expired ledger row",
    withEngine(({ project, track }) =>
      Effect.gen(function* () {
        const engine = yield* GooglePlayPaymentProvider;
        const active = yield* seedActiveSubscription(track, project, "expired");
        track.ledgerKeys.push(`google:${active.purchase.purchaseToken}:expired:${active.expiryMs}`);

        const result = yield* engine.recordSubscriptionExpired({
          configuration: active.seeded.configuration,
          eventTime: nowDate(),
          project,
          providerEnvironment: ProviderEnvironment.Production,
          purchase: active.purchase,
          receivedAt: nowDate(),
          source: "webhook",
        });
        expect(Option.isSome(result.subscriptionId)).toBe(true);

        const ledger = yield* findLedgerByKey(
          `google:${active.purchase.purchaseToken}:expired:${active.expiryMs}`,
        );
        expect(ledger?.providerEventType).toBe("expired");
      }),
    ).pipe(Effect.provide(GooglePlayEngineLive), CoreAuthSession.authenticate()),
  );

  test(
    "recordSubscriptionCanceled records the cancel-at-period-end intent on the subscription",
    withEngine(({ project, track }) =>
      Effect.gen(function* () {
        const engine = yield* GooglePlayPaymentProvider;
        const active = yield* seedActiveSubscription(track, project, "cancel");
        track.ledgerKeys.push(
          `google:${active.purchase.purchaseToken}:canceled:${active.expiryMs}`,
        );

        yield* engine.recordSubscriptionCanceled({
          configuration: active.seeded.configuration,
          eventTime: nowDate(),
          project,
          providerEnvironment: ProviderEnvironment.Production,
          purchase: active.purchase,
          receivedAt: nowDate(),
          source: "webhook",
        });

        const subRow = yield* findSubscriptionByStoreId(active.purchase.purchaseToken);
        expect(subRow?.cancelAtPeriodEnd).toBe(true);
      }),
    ).pipe(Effect.provide(GooglePlayEngineLive), CoreAuthSession.authenticate()),
  );

  test(
    "recordEntitlementRevoked routes a subscription to revokeSubscription (revoke ledger)",
    withEngine(({ project, track }) =>
      Effect.gen(function* () {
        const engine = yield* GooglePlayPaymentProvider;
        const active = yield* seedActiveSubscription(track, project, "revoke");
        track.ledgerKeys.push(`google:${active.purchase.purchaseToken}:revoke`);

        const result = yield* engine.recordEntitlementRevoked({
          configuration: active.seeded.configuration,
          eventTime: nowDate(),
          project,
          providerEnvironment: ProviderEnvironment.Production,
          purchase: active.purchase,
          receivedAt: nowDate(),
          source: "webhook",
        });
        expect(Option.isSome(result.subscriptionId)).toBe(true);

        const ledger = yield* findLedgerByKey(`google:${active.purchase.purchaseToken}:revoke`);
        expect(ledger?.providerEventType).toBe("revoke");
      }),
    ).pipe(Effect.provide(GooglePlayEngineLive), CoreAuthSession.authenticate()),
  );

  test(
    "recordBillingRetry keeps the subscription active and records the grace deadline",
    withEngine(({ project, track }) =>
      Effect.gen(function* () {
        const engine = yield* GooglePlayPaymentProvider;
        const active = yield* seedActiveSubscription(track, project, "billing-retry");
        track.ledgerKeys.push(
          `google:${active.purchase.purchaseToken}:billing_retry:${active.expiryMs}`,
        );

        yield* engine.recordBillingRetry({
          configuration: active.seeded.configuration,
          eventTime: nowDate(),
          project,
          providerEnvironment: ProviderEnvironment.Production,
          purchase: active.purchase,
          receivedAt: nowDate(),
          source: "webhook",
        });

        const subRow = yield* findSubscriptionByStoreId(active.purchase.purchaseToken);
        expect(subRow?.billingRetryAt).toBeInstanceOf(Date);
        expect(subRow?.gracePeriodExpiresAt).toBeInstanceOf(Date);
      }),
    ).pipe(Effect.provide(GooglePlayEngineLive), CoreAuthSession.authenticate()),
  );

  test(
    "recordInformationalNotification returns an ignored result and writes no operational rows",
    withEngine(({ project, track }) =>
      Effect.gen(function* () {
        const engine = yield* GooglePlayPaymentProvider;
        const seeded = yield* seedConfig(track, "informational");
        const purchase = subPurchase({ productId: seeded.productKey });

        const result = yield* engine.recordInformationalNotification({
          configuration: seeded.configuration,
          eventTime: nowDate(),
          project,
          providerEnvironment: ProviderEnvironment.Production,
          purchase,
          receivedAt: nowDate(),
          source: "webhook",
        });

        expect(result.idempotent).toBe(true);
        expect(result.personId).toBe("");
        const subRow = yield* findSubscriptionByStoreId(purchase.purchaseToken);
        expect(subRow).toBeUndefined();
      }),
    ).pipe(Effect.provide(GooglePlayEngineLive), CoreAuthSession.authenticate()),
  );
});

describe("GooglePlayPaymentProvider live Play API paths (deferred)", () => {
  // The engine's fetch + SDK-context paths mint an OAuth2 token from the
  // service-account JSON and call the Android Publisher API — neither is
  // available offline, so these mirror the App Store live-SDK-wall todos.
  vitestTest.todo(
    "buildSdkContextFromConfiguration mints an access token + builds a client — deferred: requires a real Google service-account credential and outbound network to oauth2.googleapis.com",
  );
  vitestTest.todo(
    "fetchAndNormalizeSubscription resolves authoritative state + regional catalog price — deferred: requires a live subscriptions.v2.get + monetization catalog fetch",
  );
});
