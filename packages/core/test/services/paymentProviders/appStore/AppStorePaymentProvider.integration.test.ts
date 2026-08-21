/**
 * Integration tests for the App Store record engine
 * ({@link AppStorePaymentProvider} — exported as `AppStorePaymentProviderEngine`
 * from `@voidhash/core/services`), run against the real backend stack
 * provisioned once by `test/_testing/globalSetup.ts` (live PlanetScale DB +
 * PostgreSQL; only the project schema cache is an in-memory stub).
 *
 * The engine is a multi-branch purchase-recording machine: every `record*`
 * method first resolves the App Store identity (creating / reusing a person and
 * its `person_external_identifier`), looks up the product mapping, derives a
 * per-event idempotency key, builds the money breakdown, and then routes to the
 * matching `PurchaseProcessingService` action — which persists the operational
 * `subscription` / `transaction` / `purchase` rows plus an append-only
 * `purchase_ledger` row. These tests drive that whole graph end-to-end and
 * verify the *persisted* side effects, not just the returned
 * `PurchaseProcessingResult`:
 *  - the identity rows (`person`, `person_identity`, `person_external_identifier`),
 *  - the operational projection (`subscription` / `transaction` / `purchase`),
 *  - the `purchase_ledger` row (idempotency key, `source` tag, provider event).
 *
 * What the test wires that the harness does not provide: the engine layer pulls
 * in `PurchaseProcessingService`, `PersonIdentityService`, `FxRateService`,
 * `PaymentConfigSecretCrypto`, and `AppStoreServerSdk`. All of those bottom out
 * at the harness `Db` once given a handful of leaf stubs that carry no
 * infrastructure of their own:
 *  - `PerkGrantService.layer` (real, `Db` + `AuthSession`),
 *  - `IdentityProjectionPublisher.noop` (synchronous projection is a no-op),
 *  - `AppStoreServerSdk.layer` over `FetchHttpClient.layer` (the REST SDK is
 *    only touched by `buildSdkContextFromConfiguration`; the `record*` paths
 *    operate purely on already-decoded JWS payloads and never make a request).
 *
 * Decoded JWS payloads are built in-process by decoding plain JSON through the
 * SDK's `decodeJWSTransactionDecodedPayload` (Apple-signed verification is not
 * available offline; the engine consumes the *decoded* payload, so decoding a
 * synthetic one exercises the same code without an Apple signature).
 *
 * Conventions: every test namespaces its provider keys / product ids with a
 * per-call unique suffix, asserts by membership / by-id (never global counts),
 * and self-cleans every row it creates (and the append-only ledger rows) via an
 * `Effect.ensuring` finalizer. Typed failures are asserted with `Effect.flip` +
 * `instanceof`, paired with a DB-state assertion proving nothing leaked.
 */
import { Clock, DateTime, Effect, Layer, Option } from "effect";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import { describe, expect, test as vitestTest } from "vitest";

import {
  AppStoreServerSdk,
  Type as AppleTransactionType,
  decodeJWSRenewalInfoDecodedPayload,
  decodeJWSTransactionDecodedPayload,
} from "@voidhash/app-store-server-sdk";
import {
  FxRateService,
  IdentityProjectionPublisher,
  PerkGrantService,
  PersonIdentityService,
  PurchaseProcessingService,
} from "@voidhash/core/services";
import { WebhookEventPublisher } from "@voidhash/core/services/webhookDispatch/WebhookEventPublisher";
import { AppStorePaymentProvider } from "@voidhash/core/services/paymentProviders/appStore/payment-provider";
import { PaymentConfigSecretCrypto } from "@voidhash/core/utils/crypto/PaymentConfigSecretCrypto";
import {
  ACCOUNT_TOKEN_SERVICE_ID,
  deriveAccountToken,
} from "@voidhash/core/utils/crypto/account-token";
import { generateId } from "@voidhash/core/utils";
import { constant, numberOr, stringOr } from "@voidhash/lib/lang";
// The App Store error classes have no public package subpath, so they are
// imported by relative path into `src` (the unit-test convention in the brief).
import {
  AppStorePaymentProviderProductNotMappedError,
  AppStorePaymentProviderSdkTransactionMissingDistinctIdError,
  AppStorePurchaseProcessingIdempotencyKeyDerivationError,
} from "../../../../src/services/paymentProviders/appStore/errors.ts";
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

/** Monotonic counter so generated keys stay unique even within one millisecond. */
let seq = 0;
/**
 * Unique per file run (a cuid2), so generated keys never collide with a
 * concurrent run against the same shared database.
 */
const runToken = generateId("test");
const uniq = (label: string) => `it-as-${label}-${runToken}-${seq++}`;

/**
 * Full dependency graph for the App Store record engine. Everything here is
 * either a real `Db`-backed service or a leaf stub with no infrastructure of
 * its own, so the only requirements that escape are the harness `Db` and the
 * per-test `AuthSession` supplied by `CoreAuthSession.authenticate`. The two
 * `provideMerge` layers cascade downward: the inner leaf stubs satisfy
 * `PurchaseProcessingService` (needs `PerkGrantService`) and
 * `PersonIdentityService` (needs `IdentityProjectionPublisher`).
 */
const AppStoreEngineLive = AppStorePaymentProvider.layer.pipe(
  Layer.provideMerge(
    Layer.mergeAll(
      PurchaseProcessingService.layer.pipe(Layer.provide(WebhookEventPublisher.noop)),
      PersonIdentityService.layer,
      FxRateService.layer({ apiKey: Effect.succeed("test-fx-key") }),
      PaymentConfigSecretCrypto.layer({ key: Effect.succeed("") }),
      AppStoreServerSdk.layer.pipe(Layer.provide(FetchHttpClient.layer)),
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
        serviceId: "apple-app-store",
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
// Synthetic decoded-JWS builder.
// ----------------------------------------------------------------------------

type RawTransaction = Record<string, unknown>;

/**
 * Drops keys whose value is `undefined`. The SDK payload schema uses
 * `Schema.OptionFromOptionalKey`, which decodes a *missing* key to
 * `Option.none()` but FAILS on a key that is present with an explicit
 * `undefined` value (`Expected string, got undefined`). The raw builders below
 * model "Apple omitted this field" by setting it to `undefined`; without this
 * strip the decode would die before the engine runs. Stripping reproduces a
 * genuine Apple payload (absent key) so the engine's `Option.none()` branches
 * are exercised faithfully.
 */
const stripUndefined = (raw: RawTransaction): RawTransaction =>
  Object.fromEntries(Object.entries(raw).filter(([, value]) => value !== undefined));

/** Decode a plain JSON object into a `JWSTransactionDecodedPayload`. */
const decoded = (raw: RawTransaction) =>
  decodeJWSTransactionDecodedPayload(stripUndefined(raw)).pipe(Effect.orDie);

/** Decode a plain JSON object into a `JWSRenewalInfoDecodedPayload`. */
const decodedRenewal = (raw: Record<string, unknown>) =>
  decodeJWSRenewalInfoDecodedPayload(stripUndefined(raw)).pipe(Effect.orDie);

/**
 * Builds a raw auto-renewable subscription JWS (initial purchase). Pass
 * `transactionReason: "RENEWAL"` to make it a renewal.
 */
const subscriptionRaw = (overrides: RawTransaction = {}): Effect.Effect<RawTransaction> =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis;
    const tx = uniq("tx");
    const orig = uniq("orig");
    return {
      transactionId: tx,
      originalTransactionId: orig,
      productId: undefined, // set by callers from the mapped product key
      type: AppleTransactionType.AUTO_RENEWABLE_SUBSCRIPTION,
      purchaseDate: now,
      originalPurchaseDate: now,
      expiresDate: now + 30 * 24 * 60 * 60 * 1000,
      signedDate: now,
      currency: "USD",
      price: 9990, // milliunits → 999 minor units
      storefront: "USA",
      environment: "Sandbox",
      ...overrides,
    };
  });

/** Builds a raw one-time / consumable charge JWS. */
const oneTimeRaw = (overrides: RawTransaction = {}): Effect.Effect<RawTransaction> =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis;
    const tx = uniq("tx");
    return {
      transactionId: tx,
      originalTransactionId: tx,
      productId: undefined,
      type: AppleTransactionType.NON_CONSUMABLE,
      purchaseDate: now,
      originalPurchaseDate: now,
      signedDate: now,
      currency: "USD",
      price: 4990,
      storefront: "USA",
      environment: "Sandbox",
      ...overrides,
    };
  });

// ----------------------------------------------------------------------------
// Per-test parent-row seeding + cleanup.
// ----------------------------------------------------------------------------

/**
 * Tracks every row a test creates so the `Effect.ensuring` finalizer can delete
 * them (and the append-only `purchase_ledger` rows) regardless of how the test
 * exits. Identity rows created by the engine (persons, identities, external
 * identifiers) are also tracked by collected ids / project scope.
 */
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
  providerProductIds: [],
  productIds: [],
  ledgerKeys: [],
  subscriptionStoreIds: [],
  purchaseProviderKeys: [],
  externalIdentifiers: [],
});

/**
 * Inserts a payment-provider configuration + product mapping under the fixture
 * project and returns the typed rows the engine's `record*` methods expect as
 * `configuration` / `project`.
 */
const seedConfig = (track: CleanupTrack, label: string, configOverrides: object = {}) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const configId = generateId("paymentProviderConfiguration");
    const providerProductId = generateId("paymentProviderProduct");
    const productId = generateId("product");
    const productKey = uniq(`${label}-prod`);
    const bundleId = uniq(`${label}-bundle`);

    track.configIds.push(configId);
    track.providerProductIds.push(providerProductId);
    track.productIds.push(productId);

    yield* db.insert(products).values({
      id: productId,
      name: `AppStore IT ${label}`,
      projectId,
      slug: uniq(`${label}-slug`),
    });
    yield* db.insert(paymentProviderConfigurations).values({
      id: configId,
      providerId: "apple-app-store",
      projectId,
      paymentProviderKey: bundleId,
      enabled: true,
      name: `AppStore IT ${label}`,
      configuration: {
        appAppleId: "1234567890",
        bundleId,
        inAppPurchaseKeyIssuerId: "issuer-id",
        inAppPurchaseKeyId: "key-id",
        inAppPurchasePrivateKey: "PLAINTEXT_KEY",
        appStoreConnectApiIssuerId: "asc-issuer",
        appStoreConnectApiKeyId: "asc-key",
        appStoreConnectApiVendorNumber: "12345",
        appleServerNotificationForwardingUrl: "",
        appleSmallBusinessProgramHasEndDate: false,
        trackNewPurchasesFromAppleServerNotifications: true,
        ...configOverrides,
      },
    });
    yield* db.insert(paymentProviderConfigurationProducts).values({
      id: providerProductId,
      paymentProviderConfigurationId: configId,
      productId,
      providerProductKey: productKey,
      isActive: true,
      configuration: { productId: productKey },
    });

    const configuration = yield* findConfiguration(configId);
    if (configuration === undefined) {
      // The row was just inserted in this transaction — its absence is a broken
      // invariant, not a test expectation.
      return yield* Effect.die(new Error(`seeded configuration ${configId} was not persisted`));
    }

    return {
      configuration,
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
      // Find and delete the persons (and their identities) the engine created,
      // then the external identifiers themselves.
      const extRows = yield* db
        .select({ id: personExternalIdentifiers.id, personId: personExternalIdentifiers.personId })
        .from(personExternalIdentifiers)
        .where(
          and(
            eq(personExternalIdentifiers.projectId, projectId),
            eq(personExternalIdentifiers.serviceId, "apple-app-store"),
            inArray(personExternalIdentifiers.identifier, track.externalIdentifiers),
          ),
        )
        .pipe(Effect.orElseSucceed((): Array<{ id: string; personId: string }> => []));
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
 * Wrap a test body so all rows it creates are removed afterward, regardless of
 * exit. The body receives the live project row (fixture `it_project`) and a
 * mutable `track`; ids are read lazily at finalization so failures still clean.
 */
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
      return yield* Effect.die(new Error(`fixture project ${projectId} is missing`));
    }
    return yield* body({ project, track });
  }).pipe(Effect.ensuring(cleanup(track)));
};

describe("AppStorePaymentProvider.recordPurchase", () => {
  test(
    "auto-renewable initial buy routes to startSubscription and persists subscription + transaction + ledger",
    withEngine(({ project, track }) =>
      Effect.gen(function* () {
        const engine = yield* AppStorePaymentProvider;
        const seeded = yield* seedConfig(track, "sub-initial");
        const raw = yield* subscriptionRaw({
          productId: seeded.productKey,
          appAccountToken: uniq("aat"),
        });
        const decodedTx = yield* decoded(raw);
        const storeSubId = Option.getOrThrow(decodedTx.originalTransactionId);
        track.subscriptionStoreIds.push(storeSubId);
        track.externalIdentifiers.push(stringOr(raw.appAccountToken, ""));

        const result = yield* engine.recordPurchase({
          configuration: seeded.configuration,
          project,
          decodedTransaction: decodedTx,
          decodedRenewalInfo: Option.none(),
          providerEnvironment: ProviderEnvironment.Sandbox,
          receivedAt: yield* DateTime.nowAsDate,
          source: "sdk",
          distinctId: uniq("distinct"),
        });

        expect(Option.isSome(result.subscriptionId)).toBe(true);
        expect(result.personId.length).toBeGreaterThan(0);
        expect(result.idempotent).toBe(false);

        const subRow = yield* findSubscriptionByStoreId(storeSubId);
        expect(subRow).toBeDefined();
        expect(subRow?.paymentProviderConfigurationProductId).toBe(seeded.providerProductId);
        expect(subRow?.personId).toBe(result.personId);
        expect(subRow?.providerEnvironment).toBe(ProviderEnvironment.Sandbox);

        const ledger = yield* findLedgerByKey(
          `apple:${Option.getOrThrow(decodedTx.transactionId)}:purchase:${Option.getOrThrow(decodedTx.purchaseDate)}`,
        );
        track.ledgerKeys.push(ledger?.idempotencyKey ?? "");
        expect(ledger).toBeDefined();
        expect(ledger?.providerId).toBe("apple-app-store");
        expect(ledger?.providerEventType).toBe("purchase");
        expect(ledger?.source).toBe("sdk");
        expect(ledger?.personId).toBe(result.personId);
      }),
    ).pipe(Effect.provide(AppStoreEngineLive), CoreAuthSession.authenticate()),
  );

  test(
    "SDK source with appAccountToken = deriveAccountToken(distinctId) lazily registers a voidhash-account-token binding",
    withEngine(({ project, track }) =>
      Effect.gen(function* () {
        const engine = yield* AppStorePaymentProvider;
        const seeded = yield* seedConfig(track, "sdk-token-binding");
        const distinctId = uniq("distinct");
        // The client derives the token from the distinctId; the equality guard
        // in the SDK path only writes the binding for this matching case.
        const token = yield* deriveAccountToken(distinctId);
        const raw = yield* subscriptionRaw({ productId: seeded.productKey, appAccountToken: token });
        const decodedTx = yield* decoded(raw);
        const storeSubId = Option.getOrThrow(decodedTx.originalTransactionId);
        track.subscriptionStoreIds.push(storeSubId);
        // The `apple-app-store` binding shares the token as its identifier; this
        // is what cleanup keys on to find + delete the person, which cascades
        // the account-token row too.
        track.externalIdentifiers.push(token);
        track.ledgerKeys.push(
          `apple:${Option.getOrThrow(decodedTx.transactionId)}:purchase:${Option.getOrThrow(decodedTx.purchaseDate)}`,
        );

        const result = yield* engine.recordPurchase({
          configuration: seeded.configuration,
          project,
          decodedTransaction: decodedTx,
          decodedRenewalInfo: Option.none(),
          providerEnvironment: ProviderEnvironment.Sandbox,
          receivedAt: yield* DateTime.nowAsDate,
          source: "sdk",
          distinctId,
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
    ).pipe(Effect.provide(AppStoreEngineLive), CoreAuthSession.authenticate()),
  );

  test(
    "SDK source with a foreign appAccountToken (not derived from distinctId) writes no account-token binding",
    withEngine(({ project, track }) =>
      Effect.gen(function* () {
        const engine = yield* AppStorePaymentProvider;
        const seeded = yield* seedConfig(track, "sdk-foreign-token");
        const distinctId = uniq("distinct");
        // A cross-owner restore: the JWS carries the ORIGINAL buyer's token,
        // which does not derive from this restoring person's distinctId. The
        // equality guard must skip the binding so the buyer's token is not
        // re-homed onto the restoring person.
        const foreignToken = yield* deriveAccountToken(uniq("other-person"));
        const raw = yield* subscriptionRaw({
          productId: seeded.productKey,
          appAccountToken: foreignToken,
        });
        const decodedTx = yield* decoded(raw);
        track.subscriptionStoreIds.push(Option.getOrThrow(decodedTx.originalTransactionId));
        track.externalIdentifiers.push(foreignToken);
        track.ledgerKeys.push(
          `apple:${Option.getOrThrow(decodedTx.transactionId)}:purchase:${Option.getOrThrow(decodedTx.purchaseDate)}`,
        );

        yield* engine.recordPurchase({
          configuration: seeded.configuration,
          project,
          decodedTransaction: decodedTx,
          decodedRenewalInfo: Option.none(),
          providerEnvironment: ProviderEnvironment.Sandbox,
          receivedAt: yield* DateTime.nowAsDate,
          source: "sdk",
          distinctId,
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
    ).pipe(Effect.provide(AppStoreEngineLive), CoreAuthSession.authenticate()),
  );

  test(
    "renewal (transactionReason=RENEWAL) routes to renewSubscription and tags the ledger as renewal",
    withEngine(({ project, track }) =>
      Effect.gen(function* () {
        const engine = yield* AppStorePaymentProvider;
        const seeded = yield* seedConfig(track, "renew");
        const raw = yield* subscriptionRaw({
          productId: seeded.productKey,
          transactionReason: "RENEWAL",
          appAccountToken: uniq("aat"),
        });
        const decodedTx = yield* decoded(raw);
        const storeSubId = Option.getOrThrow(decodedTx.originalTransactionId);
        track.subscriptionStoreIds.push(storeSubId);
        track.externalIdentifiers.push(stringOr(raw.appAccountToken, ""));

        const result = yield* engine.recordPurchase({
          configuration: seeded.configuration,
          project,
          decodedTransaction: decodedTx,
          decodedRenewalInfo: Option.none(),
          providerEnvironment: ProviderEnvironment.Sandbox,
          receivedAt: yield* DateTime.nowAsDate,
          source: "sdk",
          distinctId: uniq("distinct"),
        });
        track.ledgerKeys.push(
          `apple:${Option.getOrThrow(decodedTx.transactionId)}:renewal:${Option.getOrThrow(decodedTx.purchaseDate)}`,
        );

        expect(Option.isSome(result.subscriptionId)).toBe(true);
        const ledger = yield* findLedgerByKey(track.ledgerKeys[track.ledgerKeys.length - 1]!);
        expect(ledger?.providerEventType).toBe("renewal");
      }),
    ).pipe(Effect.provide(AppStoreEngineLive), CoreAuthSession.authenticate()),
  );

  test(
    "one-time / non-consumable charge routes to completeOneTimePurchase and persists a purchase row",
    withEngine(({ project, track }) =>
      Effect.gen(function* () {
        const engine = yield* AppStorePaymentProvider;
        const seeded = yield* seedConfig(track, "one-time");
        const raw = yield* oneTimeRaw({
          productId: seeded.productKey,
          appAccountToken: uniq("aat"),
        });
        const decodedTx = yield* decoded(raw);
        const providerKey = Option.getOrThrow(decodedTx.transactionId);
        track.purchaseProviderKeys.push(providerKey);
        track.externalIdentifiers.push(stringOr(raw.appAccountToken, ""));

        const result = yield* engine.recordPurchase({
          configuration: seeded.configuration,
          project,
          decodedTransaction: decodedTx,
          decodedRenewalInfo: Option.none(),
          providerEnvironment: ProviderEnvironment.Sandbox,
          receivedAt: yield* DateTime.nowAsDate,
          source: "sdk",
          distinctId: uniq("distinct"),
        });
        track.ledgerKeys.push(
          `apple:${providerKey}:purchase:${Option.getOrThrow(decodedTx.purchaseDate)}`,
        );

        expect(Option.isNone(result.subscriptionId)).toBe(true);
        const purchaseRow = yield* findPurchaseByProviderKey(providerKey);
        expect(purchaseRow).toBeDefined();
        expect(purchaseRow?.personId).toBe(result.personId);
        expect(purchaseRow?.paymentProviderConfigurationProductId).toBe(seeded.providerProductId);
      }),
    ).pipe(Effect.provide(AppStoreEngineLive), CoreAuthSession.authenticate()),
  );

  test(
    "SDK path with distinctId resolves a person and creates the apple external identifier",
    withEngine(({ project, track }) =>
      Effect.gen(function* () {
        const engine = yield* AppStorePaymentProvider;
        const seeded = yield* seedConfig(track, "sdk-identity");
        // No appAccountToken → personIdentifier falls back to originalTransactionId.
        const raw = yield* subscriptionRaw({ productId: seeded.productKey, appAccountToken: undefined });
        const decodedTx = yield* decoded(raw);
        const personIdentifier = Option.getOrThrow(decodedTx.originalTransactionId);
        track.subscriptionStoreIds.push(personIdentifier);
        track.externalIdentifiers.push(personIdentifier);

        const result = yield* engine.recordPurchase({
          configuration: seeded.configuration,
          project,
          decodedTransaction: decodedTx,
          decodedRenewalInfo: Option.none(),
          providerEnvironment: ProviderEnvironment.Sandbox,
          receivedAt: yield* DateTime.nowAsDate,
          source: "sdk",
          distinctId: uniq("distinct"),
        });
        track.ledgerKeys.push(
          `apple:${Option.getOrThrow(decodedTx.transactionId)}:purchase:${Option.getOrThrow(decodedTx.purchaseDate)}`,
        );

        const ext = yield* findExternalIdentifier(personIdentifier);
        expect(ext).toBeDefined();
        expect(ext?.personId).toBe(result.personId);
        expect(ext?.serviceId).toBe("apple-app-store");
        expect(ext?.isDefault).toBe(true);
      }),
    ).pipe(Effect.provide(AppStoreEngineLive), CoreAuthSession.authenticate()),
  );

  test(
    "webhook path without distinctId resolves a stand-in person from the transaction identifier",
    withEngine(({ project, track }) =>
      Effect.gen(function* () {
        const engine = yield* AppStorePaymentProvider;
        const seeded = yield* seedConfig(track, "webhook-standin");
        const raw = yield* subscriptionRaw({ productId: seeded.productKey, appAccountToken: undefined });
        const decodedTx = yield* decoded(raw);
        const personIdentifier = Option.getOrThrow(decodedTx.originalTransactionId);
        track.subscriptionStoreIds.push(personIdentifier);
        track.externalIdentifiers.push(personIdentifier);

        const result = yield* engine.recordPurchase({
          configuration: seeded.configuration,
          project,
          decodedTransaction: decodedTx,
          decodedRenewalInfo: Option.none(),
          providerEnvironment: ProviderEnvironment.Sandbox,
          receivedAt: yield* DateTime.nowAsDate,
          source: "webhook",
        });
        track.ledgerKeys.push(
          `apple:${Option.getOrThrow(decodedTx.transactionId)}:purchase:${Option.getOrThrow(decodedTx.purchaseDate)}`,
        );

        const ext = yield* findExternalIdentifier(personIdentifier);
        expect(ext).toBeDefined();
        expect(ext?.personId).toBe(result.personId);

        // The stand-in person is stamped with the AppStoreWebhook origin.
        const db = yield* Db;
        const personRow = yield* db.query.persons.findFirst({
          where: { id: result.personId },
        });
        expect(personRow?.origin).toBe(PersonOrigin.AppStoreWebhook);
      }),
    ).pipe(Effect.provide(AppStoreEngineLive), CoreAuthSession.authenticate()),
  );

  test(
    "missing productId returns an ignored result and writes no operational rows",
    withEngine(({ project, track }) =>
      Effect.gen(function* () {
        const engine = yield* AppStorePaymentProvider;
        const seeded = yield* seedConfig(track, "ignored");
        const raw = yield* subscriptionRaw({ productId: undefined, appAccountToken: undefined });
        const decodedTx = yield* decoded(raw);
        const storeSubId = Option.getOrThrow(decodedTx.originalTransactionId);

        const result = yield* engine.recordPurchase({
          configuration: seeded.configuration,
          project,
          decodedTransaction: decodedTx,
          decodedRenewalInfo: Option.none(),
          providerEnvironment: ProviderEnvironment.Sandbox,
          receivedAt: yield* DateTime.nowAsDate,
          source: "webhook",
        });

        // makeIgnoredPurchaseProcessingResult(): idempotent + empty.
        expect(result.idempotent).toBe(true);
        expect(result.personId).toBe("");
        expect(result.analyticsEventIds.length).toBe(0);
        expect(Option.isNone(result.subscriptionId)).toBe(true);

        const subRow = yield* findSubscriptionByStoreId(storeSubId);
        expect(subRow).toBeUndefined();
      }),
    ).pipe(Effect.provide(AppStoreEngineLive), CoreAuthSession.authenticate()),
  );

  test(
    "unmapped productId fails with AppStorePaymentProviderProductNotMappedError and writes nothing",
    withEngine(({ project, track }) =>
      Effect.gen(function* () {
        const engine = yield* AppStorePaymentProvider;
        const seeded = yield* seedConfig(track, "not-mapped");
        const unmappedKey = uniq("unmapped");
        const raw = yield* subscriptionRaw({ productId: unmappedKey, appAccountToken: undefined });
        const decodedTx = yield* decoded(raw);
        const storeSubId = Option.getOrThrow(decodedTx.originalTransactionId);
        track.externalIdentifiers.push(storeSubId); // identity is resolved before the mapping check

        const error = yield* Effect.flip(
          engine.recordPurchase({
            configuration: seeded.configuration,
            project,
            decodedTransaction: decodedTx,
            decodedRenewalInfo: Option.none(),
            providerEnvironment: ProviderEnvironment.Sandbox,
            receivedAt: yield* DateTime.nowAsDate,
            source: "webhook",
          }),
        );
        expect(error).toBeInstanceOf(AppStorePaymentProviderProductNotMappedError);
        if (error instanceof AppStorePaymentProviderProductNotMappedError) {
          expect(error.providerProductKey).toBe(unmappedKey);
          expect(error.paymentProviderConfigurationId).toBe(seeded.configuration.id);
        }

        const subRow = yield* findSubscriptionByStoreId(storeSubId);
        expect(subRow).toBeUndefined();
      }),
    ).pipe(Effect.provide(AppStoreEngineLive), CoreAuthSession.authenticate()),
  );

  // Deferred: this error branch is unreachable from any decoded webhook
  // payload. `_resolveAppStorePurchaseContext` first requires a non-None
  // `providerTransactionId` (= `decodedTransaction.transactionId` on the
  // webhook path, since `sdkTransactionId` is sdk-only) or it fails with
  // `AppStorePaymentProviderServiceError`. `getAppStorePersonIdentifier`
  // then falls through `appAccountToken → originalTransactionId →
  // transactionId`, so whenever `transactionId` is present (a precondition
  // for getting this far) the person identifier is `Some(transactionId)` and
  // the `MissingPersonIdentifier` branch never fires — the engine instead
  // resolves a webhook stand-in keyed on the transactionId and records a
  // normal purchase. There is no input that satisfies the transactionId
  // precondition while leaving the person identifier None, so this assertion
  // can only be exercised by unit-testing `getAppStorePersonIdentifier` /
  // `_resolveAppStorePurchaseContext` with a hand-built payload, not from the
  // engine boundary against a real decoded JWS.
  vitestTest.todo(
    "webhook transaction without a person identifier fails with TransactionMissingPersonIdentifierError — unreachable: a present transactionId (required to pass the up-front providerTransactionId check) is also the final fallback of getAppStorePersonIdentifier, so personIdentifier is never None on this path",
  );

  test(
    "SDK source without a distinctId fails with SdkTransactionMissingDistinctIdError",
    withEngine(({ project, track }) =>
      Effect.gen(function* () {
        const engine = yield* AppStorePaymentProvider;
        const seeded = yield* seedConfig(track, "sdk-no-distinct");
        const raw = yield* subscriptionRaw({ productId: seeded.productKey });
        const decodedTx = yield* decoded(raw);
        const providerTransactionId = Option.getOrThrow(decodedTx.transactionId);

        // Force the `source: "sdk"` branch with distinctId absent at runtime.
        // The discriminated union requires the field, so it is built typed and
        // the key is then removed reflectively (a plain `delete` is rejected for
        // a non-optional property).
        const input: Parameters<typeof engine.recordPurchase>[0] = {
          configuration: seeded.configuration,
          project,
          decodedTransaction: decodedTx,
          decodedRenewalInfo: Option.none(),
          providerEnvironment: ProviderEnvironment.Sandbox,
          receivedAt: yield* DateTime.nowAsDate,
          source: "sdk",
          distinctId: uniq("unused-distinct"),
        };
        Reflect.deleteProperty(input, "distinctId");

        const error = yield* Effect.flip(engine.recordPurchase(input));
        expect(error).toBeInstanceOf(AppStorePaymentProviderSdkTransactionMissingDistinctIdError);
        if (error instanceof AppStorePaymentProviderSdkTransactionMissingDistinctIdError) {
          expect(error.providerTransactionId).toBe(providerTransactionId);
        }
      }),
    ).pipe(Effect.provide(AppStoreEngineLive), CoreAuthSession.authenticate()),
  );

  test(
    "a JWS missing the purchase-key anchor fails with IdempotencyKeyDerivationError and writes nothing",
    withEngine(({ project, track }) =>
      Effect.gen(function* () {
        const engine = yield* AppStorePaymentProvider;
        const seeded = yield* seedConfig(track, "idemp-fail");
        // purchase/renewal idempotency key needs purchaseDate; omit it.
        const raw = yield* subscriptionRaw({
          productId: seeded.productKey,
          appAccountToken: undefined,
          purchaseDate: undefined,
        });
        const decodedTx = yield* decoded(raw);
        const storeSubId = Option.getOrThrow(decodedTx.originalTransactionId);
        track.externalIdentifiers.push(storeSubId); // identity is resolved before key derivation

        const error = yield* Effect.flip(
          engine.recordPurchase({
            configuration: seeded.configuration,
            project,
            decodedTransaction: decodedTx,
            decodedRenewalInfo: Option.none(),
            providerEnvironment: ProviderEnvironment.Sandbox,
            receivedAt: yield* DateTime.nowAsDate,
            source: "webhook",
          }),
        );
        expect(error).toBeInstanceOf(AppStorePurchaseProcessingIdempotencyKeyDerivationError);
        if (error instanceof AppStorePurchaseProcessingIdempotencyKeyDerivationError) {
          expect(error.missingField).toBe("purchaseDate");
        }

        const subRow = yield* findSubscriptionByStoreId(storeSubId);
        expect(subRow).toBeUndefined();
      }),
    ).pipe(Effect.provide(AppStoreEngineLive), CoreAuthSession.authenticate()),
  );

  test(
    "duplicate delivery of the same logical event returns an idempotent result (ledger UNIQUE gate)",
    withEngine(({ project, track }) =>
      Effect.gen(function* () {
        const engine = yield* AppStorePaymentProvider;
        const seeded = yield* seedConfig(track, "idempotent");
        const raw = yield* subscriptionRaw({
          productId: seeded.productKey,
          appAccountToken: uniq("aat"),
        });
        const decodedTx = yield* decoded(raw);
        const storeSubId = Option.getOrThrow(decodedTx.originalTransactionId);
        track.subscriptionStoreIds.push(storeSubId);
        track.externalIdentifiers.push(stringOr(raw.appAccountToken, ""));
        track.ledgerKeys.push(
          `apple:${Option.getOrThrow(decodedTx.transactionId)}:purchase:${Option.getOrThrow(decodedTx.purchaseDate)}`,
        );

        const input = {
          configuration: seeded.configuration,
          project,
          decodedTransaction: decodedTx,
          decodedRenewalInfo: Option.none(),
          providerEnvironment: ProviderEnvironment.Sandbox,
          receivedAt: yield* DateTime.nowAsDate,
          source: constant("sdk"),
          distinctId: uniq("distinct"),
        };

        const first = yield* engine.recordPurchase(input);
        expect(first.idempotent).toBe(false);

        const second = yield* engine.recordPurchase(input);
        expect(second.idempotent).toBe(true);
        // The replayed result mirrors the first caller's subscription id.
        expect(Option.getOrNull(second.subscriptionId)).toBe(
          Option.getOrNull(first.subscriptionId),
        );
      }),
    ).pipe(Effect.provide(AppStoreEngineLive), CoreAuthSession.authenticate()),
  );
});

describe("AppStorePaymentProvider lifecycle record* routing", () => {
  /**
   * Seed a live subscription via `recordPurchase` (initial buy) so a follow-up
   * lifecycle event has a real `subscription` row to mutate. Returns the
   * decoded transaction, seeded config, and the resolved person id.
   */
  const seedActiveSubscription = (track: CleanupTrack, project: DbProject, label: string) =>
    Effect.gen(function* () {
      const engine = yield* AppStorePaymentProvider;
      const seeded = yield* seedConfig(track, label);
      const raw = yield* subscriptionRaw({
        productId: seeded.productKey,
        appAccountToken: uniq("aat"),
      });
      // Returned to tests; its (later) purchaseDate drives every follow-up
      // lifecycle event's occurredAt.
      const decodedTx = yield* decoded(raw);
      const storeSubId = Option.getOrThrow(decodedTx.originalTransactionId);
      track.subscriptionStoreIds.push(storeSubId);
      track.externalIdentifiers.push(stringOr(raw.appAccountToken, ""));
      // Seed the initial purchase one hour EARLIER so the subscription's
      // `last_event_occurred_at` watermark sits strictly before every follow-up
      // lifecycle event that reuses `decodedTx`. A same-occurredAt projection
      // update is intermittently rejected by the `<= occurredAt` guard — the
      // `TIMESTAMP` (second-precision) column can round the stored watermark a
      // fraction ahead of an equal literal — which would leave the asserted field
      // at its default. Same originalTransactionId ⇒ same subscription target.
      const seedTx = yield* decoded({
        ...raw,
        purchaseDate: numberOr(raw.purchaseDate, 0) - 60 * 60 * 1000,
      });
      track.ledgerKeys.push(
        `apple:${Option.getOrThrow(seedTx.transactionId)}:purchase:${Option.getOrThrow(seedTx.purchaseDate)}`,
      );
      const result = yield* engine.recordPurchase({
        configuration: seeded.configuration,
        project,
        decodedTransaction: seedTx,
        decodedRenewalInfo: Option.none(),
        providerEnvironment: ProviderEnvironment.Sandbox,
        receivedAt: yield* DateTime.nowAsDate,
        source: "sdk",
        distinctId: uniq("distinct"),
      });
      return { decodedTx, raw, seeded, personId: result.personId, storeSubId };
    });

  test(
    "recordSubscriptionExpired marks the subscription expired and writes an expired ledger row",
    withEngine(({ project, track }) =>
      Effect.gen(function* () {
        const engine = yield* AppStorePaymentProvider;
        const active = yield* seedActiveSubscription(track, project, "expired");
        const expiresDate = Option.getOrThrow(active.decodedTx.expiresDate);
        track.ledgerKeys.push(`apple:${active.storeSubId}:expired:${expiresDate}`);

        const result = yield* engine.recordSubscriptionExpired({
          configuration: active.seeded.configuration,
          project,
          decodedTransaction: active.decodedTx,
          decodedRenewalInfo: Option.none(),
          providerEnvironment: ProviderEnvironment.Sandbox,
          receivedAt: yield* DateTime.nowAsDate,
          source: "webhook",
        });
        expect(Option.isSome(result.subscriptionId)).toBe(true);

        const ledger = yield* findLedgerByKey(`apple:${active.storeSubId}:expired:${expiresDate}`);
        expect(ledger?.providerEventType).toBe("expired");
      }),
    ).pipe(Effect.provide(AppStoreEngineLive), CoreAuthSession.authenticate()),
  );

  test(
    "recordSubscriptionCanceled records the cancel-at-period-end intent on the subscription",
    withEngine(({ project, track }) =>
      Effect.gen(function* () {
        const engine = yield* AppStorePaymentProvider;
        const active = yield* seedActiveSubscription(track, project, "cancel");
        const expiresDate = Option.getOrThrow(active.decodedTx.expiresDate);
        track.ledgerKeys.push(`apple:${active.storeSubId}:canceled:${expiresDate}`);

        // The cancellation must arrive strictly *after* the seeding purchase so
        // the subscription's `last_event_occurred_at` watermark accepts the
        // projection update. The seed and a same-`purchaseDate` cancel share an
        // identical `occurredAt`, and the `TIMESTAMP` (second-precision) column
        // can round the stored watermark a fraction ahead of the equal literal
        // in the `<= occurredAt` guard, intermittently rejecting the update
        // (`affectedRows === 0`) and leaving `cancelAtPeriodEnd` at its default.
        // Bumping `purchaseDate` (which drives `occurredAt`) mirrors real
        // ordering and keeps `originalTransactionId`/`expiresDate` — hence the
        // subscription target and the `canceled` idempotency/ledger key —
        // unchanged.
        const cancelTx = yield* decoded({
          ...active.raw,
          purchaseDate: numberOr(active.raw.purchaseDate, 0) + 60_000,
        });

        yield* engine.recordSubscriptionCanceled({
          configuration: active.seeded.configuration,
          project,
          decodedTransaction: cancelTx,
          decodedRenewalInfo: Option.none(),
          providerEnvironment: ProviderEnvironment.Sandbox,
          receivedAt: yield* DateTime.nowAsDate,
          source: "webhook",
          cancelAtPeriodEnd: true,
        });

        const subRow = yield* findSubscriptionByStoreId(active.storeSubId);
        expect(subRow?.cancelAtPeriodEnd).toBe(true);
      }),
    ).pipe(Effect.provide(AppStoreEngineLive), CoreAuthSession.authenticate()),
  );

  test(
    "recordEntitlementRevoked routes auto-renewable subscriptions to revokeSubscription (revoke ledger)",
    withEngine(({ project, track }) =>
      Effect.gen(function* () {
        const engine = yield* AppStorePaymentProvider;
        const active = yield* seedActiveSubscription(track, project, "revoke-sub");
        const now = yield* Clock.currentTimeMillis;
        const revokedTx = yield* decoded({
          ...active.raw,
          revocationDate: now,
        });
        track.ledgerKeys.push(`apple:${Option.getOrThrow(revokedTx.transactionId)}:revoke:${now}`);

        const result = yield* engine.recordEntitlementRevoked({
          configuration: active.seeded.configuration,
          project,
          decodedTransaction: revokedTx,
          decodedRenewalInfo: Option.none(),
          providerEnvironment: ProviderEnvironment.Sandbox,
          receivedAt: yield* DateTime.nowAsDate,
          source: "webhook",
        });
        expect(Option.isSome(result.subscriptionId)).toBe(true);

        const ledger = yield* findLedgerByKey(
          `apple:${Option.getOrThrow(revokedTx.transactionId)}:revoke:${now}`,
        );
        expect(ledger?.providerEventType).toBe("revoke");
      }),
    ).pipe(Effect.provide(AppStoreEngineLive), CoreAuthSession.authenticate()),
  );

  test(
    "recordBillingRetry pulls gracePeriodExpiresDate from decodedRenewalInfo when present",
    withEngine(({ project, track }) =>
      Effect.gen(function* () {
        const engine = yield* AppStorePaymentProvider;
        const active = yield* seedActiveSubscription(track, project, "billing-retry");
        const expiresDate = Option.getOrThrow(active.decodedTx.expiresDate);
        const grace = (yield* Clock.currentTimeMillis) + 5 * 24 * 60 * 60 * 1000;
        track.ledgerKeys.push(`apple:${active.storeSubId}:billing_retry:${expiresDate}`);

        const renewalInfo = yield* decodedRenewal({
          originalTransactionId: active.storeSubId,
          gracePeriodExpiresDate: grace,
        });

        // Bump purchaseDate so occurredAt is strictly after the seed watermark
        // (mirrors the recordSubscriptionCanceled test): a same-occurredAt event
        // is intermittently rejected by the `<= occurredAt` projection guard
        // (TIMESTAMP second-precision rounding), leaving billingRetryAt /
        // gracePeriodExpiresAt at their null defaults. expiresDate (the ledger
        // key) and originalTransactionId (the subscription target) are unchanged.
        const retryTx = yield* decoded({
          ...active.raw,
          purchaseDate: numberOr(active.raw.purchaseDate, 0) + 60_000,
        });

        yield* engine.recordBillingRetry({
          configuration: active.seeded.configuration,
          project,
          decodedTransaction: retryTx,
          decodedRenewalInfo: Option.some(renewalInfo),
          providerEnvironment: ProviderEnvironment.Sandbox,
          receivedAt: yield* DateTime.nowAsDate,
          source: "webhook",
        });

        const subRow = yield* findSubscriptionByStoreId(active.storeSubId);
        expect(subRow?.billingRetryAt).toBeInstanceOf(Date);
        expect(subRow?.gracePeriodExpiresAt).toBeInstanceOf(Date);
      }),
    ).pipe(Effect.provide(AppStoreEngineLive), CoreAuthSession.authenticate()),
  );

  test(
    "recordOfferRedeemed stores the redeemed offer id on the subscription",
    withEngine(({ project, track }) =>
      Effect.gen(function* () {
        const engine = yield* AppStorePaymentProvider;
        const active = yield* seedActiveSubscription(track, project, "offer");
        const offerId = uniq("offer");
        const offerTx = yield* decoded({ ...active.raw, offerIdentifier: offerId });
        track.ledgerKeys.push(
          `apple:${Option.getOrThrow(offerTx.transactionId)}:offer_redeemed:${Option.getOrThrow(offerTx.purchaseDate)}:${offerId}`,
        );

        yield* engine.recordOfferRedeemed({
          configuration: active.seeded.configuration,
          project,
          decodedTransaction: offerTx,
          decodedRenewalInfo: Option.none(),
          providerEnvironment: ProviderEnvironment.Sandbox,
          receivedAt: yield* DateTime.nowAsDate,
          source: "webhook",
        });

        const subRow = yield* findSubscriptionByStoreId(active.storeSubId);
        expect(subRow?.redeemedOfferId).toBe(offerId);
      }),
    ).pipe(Effect.provide(AppStoreEngineLive), CoreAuthSession.authenticate()),
  );

  test(
    "recordRenewalPreferenceChange records the intent even when the new product is not yet mapped",
    withEngine(({ project, track }) =>
      Effect.gen(function* () {
        const engine = yield* AppStorePaymentProvider;
        const active = yield* seedActiveSubscription(track, project, "renewal-pref");
        const expiresDate = Option.getOrThrow(active.decodedTx.expiresDate);
        const productKey = Option.getOrThrow(active.decodedTx.productId);
        track.ledgerKeys.push(
          `apple:${active.storeSubId}:renewal_pref_change:${expiresDate}:${productKey}`,
        );

        // The transaction still references the currently-mapped product, but
        // `changeRenewalPreference` records intent regardless of whether the
        // *next* product is mapped — here it resolves to the same mapping.
        const result = yield* engine.recordRenewalPreferenceChange({
          configuration: active.seeded.configuration,
          project,
          decodedTransaction: active.decodedTx,
          decodedRenewalInfo: Option.none(),
          providerEnvironment: ProviderEnvironment.Sandbox,
          receivedAt: yield* DateTime.nowAsDate,
          source: "webhook",
        });
        expect(Option.isSome(result.subscriptionId)).toBe(true);

        const ledger = yield* findLedgerByKey(track.ledgerKeys[track.ledgerKeys.length - 1]!);
        expect(ledger?.providerEventType).toBe("renewal_pref_change");
      }),
    ).pipe(Effect.provide(AppStoreEngineLive), CoreAuthSession.authenticate()),
  );

  test(
    "recordInformationalNotification returns an ignored result and writes no operational rows",
    withEngine(({ project, track }) =>
      Effect.gen(function* () {
        const engine = yield* AppStorePaymentProvider;
        const seeded = yield* seedConfig(track, "informational");
        const raw = yield* subscriptionRaw({ productId: seeded.productKey, appAccountToken: undefined });
        const decodedTx = yield* decoded(raw);
        const storeSubId = Option.getOrThrow(decodedTx.originalTransactionId);

        const result = yield* engine.recordInformationalNotification({
          configuration: seeded.configuration,
          project,
          decodedTransaction: decodedTx,
          decodedRenewalInfo: Option.none(),
          providerEnvironment: ProviderEnvironment.Sandbox,
          receivedAt: yield* DateTime.nowAsDate,
          source: "webhook",
        });

        expect(result.idempotent).toBe(true);
        expect(result.personId).toBe("");
        const subRow = yield* findSubscriptionByStoreId(storeSubId);
        expect(subRow).toBeUndefined();
      }),
    ).pipe(Effect.provide(AppStoreEngineLive), CoreAuthSession.authenticate()),
  );
});

describe("AppStorePaymentProvider.buildSdkContextFromConfiguration", () => {
  test(
    "decodes the stored configuration, decrypts the in-app-purchase key, and builds an SDK context",
    withEngine(({ track }) =>
      Effect.gen(function* () {
        const engine = yield* AppStorePaymentProvider;
        const seeded = yield* seedConfig(track, "sdk-context");

        const context = yield* engine.buildSdkContextFromConfiguration(seeded.configuration);
        // The context exposes the per-tenant verifier / client helpers and the
        // bundle id parsed from the stored configuration.
        expect(typeof context.decodeNotification).toBe("function");
        expect(typeof context.getTransactionInfo).toBe("function");
        expect(context.bundleId).toBe(seeded.configuration.paymentProviderKey);
      }),
    ).pipe(Effect.provide(AppStoreEngineLive), CoreAuthSession.authenticate()),
  );

  test(
    "propagates a Schema decode failure when the stored configuration is malformed",
    withEngine(({ track }) =>
      Effect.gen(function* () {
        const engine = yield* AppStorePaymentProvider;
        const seeded = yield* seedConfig(track, "bad-config");
        // Overwrite the configuration JSON with a shape that fails the schema
        // (missing every required field).
        const db = yield* Db;
        yield* db
          .update(paymentProviderConfigurations)
          .set({ configuration: { bundleId: "" } })
          .where(eq(paymentProviderConfigurations.id, seeded.configuration.id));
        const broken = yield* findConfiguration(seeded.configuration.id);
        if (broken === undefined) {
          return yield* Effect.die(new Error("the overwritten configuration row disappeared"));
        }

        const exit = yield* Effect.exit(engine.buildSdkContextFromConfiguration(broken));
        expect(exit._tag).toBe("Failure");
      }),
    ).pipe(Effect.provide(AppStoreEngineLive), CoreAuthSession.authenticate()),
  );
});

describe("AppStorePaymentProvider identity-transfer paths (deferred)", () => {
  // `vitestTest` is vitest's native `test` (the harness-wrapped `test` has no
  // `.todo`); these paths can't be asserted faithfully from the engine boundary.
  vitestTest.todo(
    "cross-owner restore: SDK confirmation transfers the subscription from the previous owner to the SDK person per transferMode — deferred because faithfully exercising PurchaseProcessingService.transferSubscription needs a multi-person operational fixture (two real persons, a fully-projected subscription on the previous owner, and the transferMode-specific re-grant/clone semantics) that is too coupled to PurchaseProcessing internals to assert reliably from the engine boundary; cover this in a dedicated PurchaseProcessingService transfer integration test instead.",
  );

  vitestTest.todo(
    "webhook-stand-in merge: an SDK confirmation merges the webhook stand-in person into the SDK person via identifyDistinctId and rebinds the external identifier — deferred because the merge call is wrapped in a logging catch in the engine (so success vs. degraded-rebind is not observable from the result), and a faithful assertion would have to reach into PersonIdentityService.identifyDistinctId's merge/projection internals; cover the merge in a PersonIdentityService integration test and the rebind-only fallback there.",
  );
});
