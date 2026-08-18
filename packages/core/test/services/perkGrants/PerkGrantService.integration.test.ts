/**
 * Integration tests for {@link PerkGrantService}, run against the real backend
 * stack provisioned once by `test/_testing/globalSetup.ts` (live PlanetScale DB
 * and PostgreSQL; only the project schema cache is an in-memory stub).
 *
 * `PerkGrantService` reconciles a person's `person_unlocked_perk` rows against
 * their `subscription` / `purchase` rows and the product→perk catalog. There is
 * no audit trail or schema-cache invalidation on this path, so every assertion
 * is against the *persisted* `person_unlocked_perk` rows read straight back from
 * the database after a `syncUnlockedPerks` call.
 *
 * Each test builds its own isolated entitlement graph under the shared fixture
 * project ({@link CoreTestFixture}): a person, a perk, a product linked to that
 * perk via `product_perk`, a payment-provider configuration + configuration
 * product, and the subscription / purchase rows that should (or should not)
 * grant the perk. {@link withGraphCleanup} deletes every row each test creates
 * on exit, success or failure (the global sweep is only a backstop). Assertions
 * stay membership-based — a test only inspects the perks of the person it
 * seeded — and ids are unique per call so a leftover row from a crashed run
 * can't collide.
 *
 * Conventions reused from `PerkService.integration.test.ts`:
 *  - Auth flows through {@link CoreAuthSession.authenticate}; the permission test
 *    re-authenticates just the guarded call via {@link asUnauthorized}.
 *  - Typed failures are asserted with `Effect.flip` + `instanceof`, paired with
 *    a DB-state assertion proving the failure wrote nothing.
 */
import { PurchaseType, SubscriptionStatus } from "@voidhash/lib";
import { constant } from "@voidhash/lib/lang";
import { Clock, DateTime, Effect } from "effect";
import { describe, expect } from "vitest";

import { PerkGrantService } from "@voidhash/core/services";
import {
  RequestEnvironmentMode,
  resolveRequestEnvironmentMode,
} from "@voidhash/core/services/requestEnvironment/RequestEnvironmentMode";
import { ActionForbiddenError, type UserSession } from "@voidhash/core/domain/auth/Auth";
import { PersonNotFoundError } from "@voidhash/core/domain/person/Person";
import { generateId } from "@voidhash/core/utils/generate-id";
import {
  Db,
  type DbTransaction,
  PersonUnlockedPerkStatus,
  ProviderEnvironment,
  eq,
  inArray,
  paymentProviderConfigurationProducts,
  paymentProviderConfigurations,
  perks,
  personUnlockedPerks,
  persons,
  productPerks,
  products,
  purchases,
  subscriptions,
} from "@voidhash/db";

import { CoreAuthSession } from "@testing/CoreAuthSession";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";
import { CoreTestFixture } from "@testing/CoreTestFixture";

const { test } = CoreIntegrationTestHarness.make();

/**
 * Runs `body` in a real DB transaction, threading the `tx` handle to
 * `syncUnlockedPerks` (which now reconciles on the caller's transaction). The
 * production caller — `PurchaseProcessingService` — drives it the same way,
 * inside its own purchase-write `db.transaction`.
 */
const inTransaction = <A, E, R>(body: (tx: DbTransaction) => Effect.Effect<A, E, R>) =>
  Effect.flatMap(Db, (db) => db.transaction(body));

const projectId = CoreTestFixture.projectId;

/** Monotonic counter so generated provider keys stay unique within a millisecond. */
let seq = 0;
const uniqueKey = (label: string, nowMillis: number) =>
  `it-perkgrant-${label}-${nowMillis}-${seq++}`;

/** `Date` at `millis` since the epoch — the `new Date(millis)` seam. */
const dateAtMillis = (millis: number): Date => DateTime.toDateUtc(DateTime.makeUnsafe(millis));

/**
 * Tracks every row a test creates so {@link withGraphCleanup} can delete them on
 * exit. Keyed by table; ids are accumulated lazily while the body runs.
 */
type CreatedIds = {
  readonly persons: string[];
  readonly perks: string[];
  readonly products: string[];
  readonly productPerks: string[];
  readonly configurations: string[];
  readonly configurationProducts: string[];
  readonly subscriptions: string[];
  readonly purchases: string[];
};

const emptyCreated = (): CreatedIds => ({
  configurationProducts: [],
  configurations: [],
  perks: [],
  productPerks: [],
  products: [],
  purchases: [],
  persons: [],
  subscriptions: [],
});

/** Read all unlocked-perk rows for a person straight from the database. */
const findUnlockedPerks = (personId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.personUnlockedPerks.findMany({
      where: { personId },
    });
  });

/**
 * Delete every tracked row, deepest foreign-key dependents first. `person_perk`
 * rows the service inserts during the test are also captured (by re-reading the
 * person's perks at cleanup time) so nothing leaks. Each delete is `ignore`d so
 * a missing row never turns the finalizer into a failure.
 */
const cleanupGraph = (created: CreatedIds) =>
  Effect.gen(function* () {
    const db = yield* Db;

    // The service inserts person_unlocked_perk rows we don't track individually;
    // sweep them by personId so created grants are removed too. This also covers
    // every directly-seeded grant for the person.
    for (const personId of created.persons) {
      yield* db
        .delete(personUnlockedPerks)
        .where(eq(personUnlockedPerks.personId, personId))
        .pipe(Effect.ignore);
    }

    // Deepest foreign-key dependents first. Each delete is `ignore`d so a missing
    // row never turns the finalizer into a failure.
    if (created.subscriptions.length > 0) {
      yield* db
        .delete(subscriptions)
        .where(inArray(subscriptions.id, created.subscriptions))
        .pipe(Effect.ignore);
    }
    if (created.purchases.length > 0) {
      yield* db
        .delete(purchases)
        .where(inArray(purchases.id, created.purchases))
        .pipe(Effect.ignore);
    }
    if (created.productPerks.length > 0) {
      yield* db
        .delete(productPerks)
        .where(inArray(productPerks.id, created.productPerks))
        .pipe(Effect.ignore);
    }
    if (created.configurationProducts.length > 0) {
      yield* db
        .delete(paymentProviderConfigurationProducts)
        .where(inArray(paymentProviderConfigurationProducts.id, created.configurationProducts))
        .pipe(Effect.ignore);
    }
    if (created.configurations.length > 0) {
      yield* db
        .delete(paymentProviderConfigurations)
        .where(inArray(paymentProviderConfigurations.id, created.configurations))
        .pipe(Effect.ignore);
    }
    if (created.products.length > 0) {
      yield* db.delete(products).where(inArray(products.id, created.products)).pipe(Effect.ignore);
    }
    if (created.perks.length > 0) {
      yield* db.delete(perks).where(inArray(perks.id, created.perks)).pipe(Effect.ignore);
    }
    if (created.persons.length > 0) {
      yield* db.delete(persons).where(inArray(persons.id, created.persons)).pipe(Effect.ignore);
    }
  });

/**
 * Wrap a test body so every row it creates is removed afterward, regardless of
 * how the test exits. The body receives the mutable {@link CreatedIds} record to
 * push ids onto; cleanup reads it lazily at finalization via `Effect.ensuring`,
 * so it sees every id tracked while the body ran (including on failure).
 */
const withGraphCleanup = <E, R>(
  body: (created: CreatedIds) => Effect.Effect<void, E, R>,
): Effect.Effect<void, E, R | Db> => {
  const created = emptyCreated();
  return body(created).pipe(Effect.ensuring(cleanupGraph(created)));
};

/**
 * Seed a person + a perk + a product wired to that perk via `product_perk`,
 * plus the payment-provider configuration and configuration product that
 * subscriptions / purchases reference. Returns the ids needed to attach
 * entitlements. All rows are tracked for cleanup.
 */
const seedEntitlementGraph = (created: CreatedIds, label: string) =>
  Effect.gen(function* () {
    const db = yield* Db;

    const nowMillis = yield* Clock.currentTimeMillis;
    const personId = generateId("person");
    const perkId = generateId("perk");
    const productId = generateId("product");
    const productPerkId = generateId("productPerk");
    const configurationId = generateId("paymentProviderConfiguration");
    const configurationProductId = generateId("paymentProviderProduct");

    yield* db.insert(persons).values({
      email: null,
      id: personId,
      name: `IT PerkGrant ${label}`,
      projectId,
    });
    yield* db.insert(perks).values({
      id: perkId,
      name: `Perk ${label}`,
      projectId,
      slug: uniqueKey(`perk-${label}`, nowMillis),
    });
    yield* db.insert(products).values({
      id: productId,
      name: `Product ${label}`,
      projectId,
      slug: uniqueKey(`product-${label}`, nowMillis),
    });
    yield* db.insert(productPerks).values({
      id: productPerkId,
      perkId,
      productId,
    });
    yield* db.insert(paymentProviderConfigurations).values({
      id: configurationId,
      name: `Config ${label}`,
      paymentProviderKey: uniqueKey(`config-${label}`, nowMillis),
      projectId,
      providerId: "app_store",
    });
    yield* db.insert(paymentProviderConfigurationProducts).values({
      id: configurationProductId,
      paymentProviderConfigurationId: configurationId,
      productId,
      providerProductKey: uniqueKey(`pp-${label}`, nowMillis),
    });

    created.persons.push(personId);
    created.perks.push(perkId);
    created.products.push(productId);
    created.productPerks.push(productPerkId);
    created.configurations.push(configurationId);
    created.configurationProducts.push(configurationProductId);

    return constant({ configurationProductId, perkId, personId, productId });
  });

/** Insert a subscription for the given person + configuration product. */
const seedSubscription = (
  created: CreatedIds,
  args: {
    readonly personId: string;
    readonly configurationProductId: string;
    readonly status: number;
    readonly expiresAt: Date | null;
    readonly providerEnvironment?: number;
  },
) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const id = generateId("subscription");
    const now = yield* DateTime.nowAsDate;
    yield* db.insert(subscriptions).values({
      expiresAt: args.expiresAt,
      id,
      initialTransactionId: uniqueKey("sub-init", now.getTime()),
      latestTransactionId: uniqueKey("sub-latest", now.getTime()),
      paymentProviderConfigurationProductId: args.configurationProductId,
      personId: args.personId,
      providerEnvironment: args.providerEnvironment ?? ProviderEnvironment.Production,
      purchasedAt: now,
      startsAt: now,
      status: args.status,
      storeSubscriptionId: uniqueKey("sub-store", now.getTime()),
    });
    created.subscriptions.push(id);
    return id;
  });

/** Insert a purchase for the given person + configuration product. */
const seedPurchase = (
  created: CreatedIds,
  args: {
    readonly personId: string;
    readonly configurationProductId: string;
    readonly refundedAt?: Date | null;
    readonly revokedAt?: Date | null;
    readonly providerEnvironment?: number;
  },
) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const id = generateId("purchase");
    const nowMillis = yield* Clock.currentTimeMillis;
    yield* db.insert(purchases).values({
      id,
      paymentProviderConfigurationProductId: args.configurationProductId,
      personId: args.personId,
      providerEnvironment: args.providerEnvironment ?? ProviderEnvironment.Production,
      providerKey: uniqueKey("pur", nowMillis),
      refundedAt: args.refundedAt ?? null,
      revokedAt: args.revokedAt ?? null,
      type: PurchaseType.OneTime,
    });
    created.purchases.push(id);
    return id;
  });

/** Insert a person_unlocked_perk row directly (to set up reactivate/expire). */
const seedUnlockedPerk = (
  created: CreatedIds,
  args: {
    readonly personId: string;
    readonly perkId: string;
    readonly status: number;
    readonly unlockedBySubscriptionId?: string | null;
    readonly unlockedByPurchaseId?: string | null;
    readonly expiresAt?: Date | null;
    readonly environment?: number;
  },
) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const id = generateId("personUnlockedPerk");
    yield* db.insert(personUnlockedPerks).values({
      expiresAt: args.expiresAt ?? null,
      environment: args.environment ?? ProviderEnvironment.Production,
      id,
      perkId: args.perkId,
      personId: args.personId,
      status: args.status,
      unlockedByPurchaseId: args.unlockedByPurchaseId ?? null,
      unlockedBySubscriptionId: args.unlockedBySubscriptionId ?? null,
    });
    return id;
  });

/** A `user`-method session for the fixture principal carrying no project access. */
const sessionWithoutProjectAccess = (): UserSession => ({
  cookie: null,
  method: "user",
  name: `${CoreTestFixture.userName} <${CoreTestFixture.userEmail}>`,
  organizations: [],
  person: null,
  projects: [],
  user: {
    createdAt: dateAtMillis(0),
    email: CoreTestFixture.userEmail,
    emailVerified: true,
    id: CoreTestFixture.userId,
    image: null,
    name: CoreTestFixture.userName,
    role: null,
    updatedAt: dateAtMillis(0),
    workosUserId: CoreTestFixture.workosUserId,
  },
});

/**
 * Run a single call as a caller with no project access. Re-authenticates just
 * this effect with the no-access session; the inner provision shadows the
 * harness's default full-permission session for the wrapped call only.
 */
const asUnauthorized = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(CoreAuthSession.authenticate(sessionWithoutProjectAccess()));

describe("PerkGrantService.syncUnlockedPerks", () => {
  test(
    "reconciles production and development grants independently",
    withGraphCleanup((created) =>
      Effect.gen(function* () {
        const service = yield* PerkGrantService;
        const { configurationProductId, perkId, personId } = yield* seedEntitlementGraph(
          created,
          "mixed-environments",
        );
        yield* seedPurchase(created, {
          configurationProductId,
          personId,
          providerEnvironment: ProviderEnvironment.Production,
        });
        const developmentSubscriptionId = yield* seedSubscription(created, {
          configurationProductId,
          expiresAt: null,
          personId,
          providerEnvironment: ProviderEnvironment.Development,
          status: SubscriptionStatus.Active,
        });

        yield* inTransaction((tx) => service.syncUnlockedPerks(tx, personId));

        const initial = yield* findUnlockedPerks(personId);
        expect(initial).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              environment: ProviderEnvironment.Production,
              perkId,
              status: PersonUnlockedPerkStatus.Active,
            }),
            expect.objectContaining({
              environment: ProviderEnvironment.Development,
              perkId,
              status: PersonUnlockedPerkStatus.Active,
            }),
          ]),
        );

        const db = yield* Db;
        yield* db
          .update(subscriptions)
          .set({ status: SubscriptionStatus.Canceled })
          .where(eq(subscriptions.id, developmentSubscriptionId));
        yield* inTransaction((tx) => service.syncUnlockedPerks(tx, personId));

        const reconciled = yield* findUnlockedPerks(personId);
        expect(
          reconciled.find((grant) => grant.environment === ProviderEnvironment.Production)?.status,
        ).toBe(PersonUnlockedPerkStatus.Active);
        expect(
          reconciled.find((grant) => grant.environment === ProviderEnvironment.Development)?.status,
        ).toBe(PersonUnlockedPerkStatus.Expired);

        const production = yield* service.getPersonUnlockedPerks(personId);
        const development = yield* service
          .getPersonUnlockedPerks(personId)
          .pipe(
            Effect.provideService(
              RequestEnvironmentMode,
              resolveRequestEnvironmentMode("development"),
            ),
          );
        const all = yield* service
          .getPersonUnlockedPerks(personId)
          .pipe(
            Effect.provideService(RequestEnvironmentMode, resolveRequestEnvironmentMode("all")),
          );
        expect(production.map((grant) => grant.environment)).toEqual([
          ProviderEnvironment.Production,
        ]);
        expect(development.map((grant) => grant.environment)).toEqual([
          ProviderEnvironment.Development,
        ]);
        expect(new Set(all.map((grant) => grant.environment))).toEqual(
          new Set([ProviderEnvironment.Production, ProviderEnvironment.Development]),
        );
      }),
    ).pipe(Effect.provide(PerkGrantService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "grants a perk for an active subscription, propagating its expiresAt",
    withGraphCleanup((created) =>
      Effect.gen(function* () {
        const service = yield* PerkGrantService;
        const { configurationProductId, perkId, personId } = yield* seedEntitlementGraph(
          created,
          "sub-create",
        );
        // The `expires_at` column is a plain MySQL TIMESTAMP (no fractional
        // seconds), so the millisecond component is dropped on round-trip; zero
        // it here to keep the `getTime()` comparison exact.
        const nowMillis = yield* Clock.currentTimeMillis;
        const expiresAt = dateAtMillis(nowMillis + 30 * 24 * 60 * 60 * 1000);
        expiresAt.setMilliseconds(0);
        const subscriptionId = yield* seedSubscription(created, {
          configurationProductId,
          expiresAt,
          personId,
          status: SubscriptionStatus.Active,
        });

        const affected = yield* inTransaction((tx) => service.syncUnlockedPerks(tx, personId));
        expect(affected.length).toBe(1);

        const rows = yield* findUnlockedPerks(personId);
        const granted = rows.find((row) => row.perkId === perkId);
        expect(granted).toBeDefined();
        expect(granted?.status).toBe(PersonUnlockedPerkStatus.Active);
        expect(granted?.unlockedBySubscriptionId).toBe(subscriptionId);
        expect(granted?.unlockedByPurchaseId).toBeNull();
        expect(granted?.expiresAt?.getTime()).toBe(expiresAt.getTime());
        expect(affected).toContain(granted?.id);
      }),
    ).pipe(Effect.provide(PerkGrantService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "grants a perk for an active purchase with a null expiresAt",
    withGraphCleanup((created) =>
      Effect.gen(function* () {
        const service = yield* PerkGrantService;
        const { configurationProductId, perkId, personId } = yield* seedEntitlementGraph(
          created,
          "pur-create",
        );
        const purchaseId = yield* seedPurchase(created, {
          configurationProductId,
          personId,
        });

        const affected = yield* inTransaction((tx) => service.syncUnlockedPerks(tx, personId));
        expect(affected.length).toBe(1);

        const rows = yield* findUnlockedPerks(personId);
        const granted = rows.find((row) => row.perkId === perkId);
        expect(granted).toBeDefined();
        expect(granted?.status).toBe(PersonUnlockedPerkStatus.Active);
        expect(granted?.unlockedByPurchaseId).toBe(purchaseId);
        expect(granted?.unlockedBySubscriptionId).toBeNull();
        expect(granted?.expiresAt).toBeNull();
      }),
    ).pipe(Effect.provide(PerkGrantService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "does not grant a perk for an inactive (canceled) subscription",
    withGraphCleanup((created) =>
      Effect.gen(function* () {
        const service = yield* PerkGrantService;
        const { configurationProductId, perkId, personId } = yield* seedEntitlementGraph(
          created,
          "sub-inactive",
        );
        yield* seedSubscription(created, {
          configurationProductId,
          expiresAt: null,
          personId,
          status: SubscriptionStatus.Canceled,
        });

        const affected = yield* inTransaction((tx) => service.syncUnlockedPerks(tx, personId));
        expect(affected.length).toBe(0);

        const rows = yield* findUnlockedPerks(personId);
        expect(rows.some((row) => row.perkId === perkId)).toBe(false);
      }),
    ).pipe(Effect.provide(PerkGrantService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "does not grant a perk for a refunded purchase",
    withGraphCleanup((created) =>
      Effect.gen(function* () {
        const service = yield* PerkGrantService;
        const { configurationProductId, perkId, personId } = yield* seedEntitlementGraph(
          created,
          "pur-refunded",
        );
        const refundedAt = yield* DateTime.nowAsDate;
        yield* seedPurchase(created, {
          configurationProductId,
          personId,
          refundedAt,
        });

        const affected = yield* inTransaction((tx) => service.syncUnlockedPerks(tx, personId));
        expect(affected.length).toBe(0);

        const rows = yield* findUnlockedPerks(personId);
        expect(rows.some((row) => row.perkId === perkId)).toBe(false);
      }),
    ).pipe(Effect.provide(PerkGrantService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "does not grant a perk for a revoked purchase",
    withGraphCleanup((created) =>
      Effect.gen(function* () {
        const service = yield* PerkGrantService;
        const { configurationProductId, perkId, personId } = yield* seedEntitlementGraph(
          created,
          "pur-revoked",
        );
        const revokedAt = yield* DateTime.nowAsDate;
        yield* seedPurchase(created, {
          configurationProductId,
          personId,
          revokedAt,
        });

        const affected = yield* inTransaction((tx) => service.syncUnlockedPerks(tx, personId));
        expect(affected.length).toBe(0);

        const rows = yield* findUnlockedPerks(personId);
        expect(rows.some((row) => row.perkId === perkId)).toBe(false);
      }),
    ).pipe(Effect.provide(PerkGrantService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "reactivates an expired subscription perk when the subscription becomes active again",
    withGraphCleanup((created) =>
      Effect.gen(function* () {
        const service = yield* PerkGrantService;
        const { configurationProductId, perkId, personId } = yield* seedEntitlementGraph(
          created,
          "sub-reactivate",
        );
        // Zero milliseconds: `expires_at` is a second-precision TIMESTAMP, so a
        // sub-second component would not survive the DB round-trip below.
        const nowMillis = yield* Clock.currentTimeMillis;
        const expiresAt = dateAtMillis(nowMillis + 7 * 24 * 60 * 60 * 1000);
        expiresAt.setMilliseconds(0);
        const subscriptionId = yield* seedSubscription(created, {
          configurationProductId,
          expiresAt,
          personId,
          status: SubscriptionStatus.Active,
        });
        const existingId = yield* seedUnlockedPerk(created, {
          expiresAt: null,
          perkId,
          personId,
          status: PersonUnlockedPerkStatus.Expired,
          unlockedBySubscriptionId: subscriptionId,
        });

        const affected = yield* inTransaction((tx) => service.syncUnlockedPerks(tx, personId));
        expect(affected).toContain(existingId);

        const rows = yield* findUnlockedPerks(personId);
        const reactivated = rows.find((row) => row.id === existingId);
        expect(reactivated?.status).toBe(PersonUnlockedPerkStatus.Active);
        expect(reactivated?.unlockedBySubscriptionId).toBe(subscriptionId);
        expect(reactivated?.unlockedByPurchaseId).toBeNull();
        expect(reactivated?.expiresAt?.getTime()).toBe(expiresAt.getTime());

        // No duplicate grant for the same perk.
        expect(rows.filter((row) => row.perkId === perkId).length).toBe(1);
      }),
    ).pipe(Effect.provide(PerkGrantService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "promotes a subscription-granted perk to a purchase grant (purchase wins on membership)",
    withGraphCleanup((created) =>
      Effect.gen(function* () {
        const service = yield* PerkGrantService;
        const { configurationProductId, perkId, personId } = yield* seedEntitlementGraph(
          created,
          "sub-to-pur",
        );
        // The perk was previously granted by an (now absent) subscription, then a
        // purchase for the same product arrives. The purchase pass runs first and
        // claims the perk, so the existing row is rewritten as a purchase grant.
        const purchaseId = yield* seedPurchase(created, {
          configurationProductId,
          personId,
        });
        const existingId = yield* seedUnlockedPerk(created, {
          expiresAt: dateAtMillis((yield* Clock.currentTimeMillis) + 1000),
          perkId,
          personId,
          status: PersonUnlockedPerkStatus.Active,
          unlockedBySubscriptionId: "sub_stale_reference",
        });

        const affected = yield* inTransaction((tx) => service.syncUnlockedPerks(tx, personId));
        expect(affected).toContain(existingId);

        const rows = yield* findUnlockedPerks(personId);
        const promoted = rows.find((row) => row.id === existingId);
        expect(promoted?.status).toBe(PersonUnlockedPerkStatus.Active);
        expect(promoted?.unlockedByPurchaseId).toBe(purchaseId);
        expect(promoted?.unlockedBySubscriptionId).toBeNull();
        expect(promoted?.expiresAt).toBeNull();
        expect(rows.filter((row) => row.perkId === perkId).length).toBe(1);
      }),
    ).pipe(Effect.provide(PerkGrantService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "expires an active subscription-granted perk when the subscription is no longer active",
    withGraphCleanup((created) =>
      Effect.gen(function* () {
        const service = yield* PerkGrantService;
        const { configurationProductId, perkId, personId } = yield* seedEntitlementGraph(
          created,
          "sub-expire",
        );
        // Subscription exists but is canceled => no desired entitlement => expire.
        const subscriptionId = yield* seedSubscription(created, {
          configurationProductId,
          expiresAt: null,
          personId,
          status: SubscriptionStatus.Canceled,
        });
        const existingId = yield* seedUnlockedPerk(created, {
          perkId,
          personId,
          status: PersonUnlockedPerkStatus.Active,
          unlockedBySubscriptionId: subscriptionId,
        });

        const affected = yield* inTransaction((tx) => service.syncUnlockedPerks(tx, personId));
        expect(affected).toContain(existingId);

        const rows = yield* findUnlockedPerks(personId);
        const expired = rows.find((row) => row.id === existingId);
        expect(expired?.status).toBe(PersonUnlockedPerkStatus.Expired);
      }),
    ).pipe(Effect.provide(PerkGrantService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "expires an active purchase-granted perk when the purchase is refunded",
    withGraphCleanup((created) =>
      Effect.gen(function* () {
        const service = yield* PerkGrantService;
        const { configurationProductId, perkId, personId } = yield* seedEntitlementGraph(
          created,
          "pur-expire",
        );
        const refundedAt = yield* DateTime.nowAsDate;
        const purchaseId = yield* seedPurchase(created, {
          configurationProductId,
          personId,
          refundedAt,
        });
        const existingId = yield* seedUnlockedPerk(created, {
          perkId,
          personId,
          status: PersonUnlockedPerkStatus.Active,
          unlockedByPurchaseId: purchaseId,
        });

        const affected = yield* inTransaction((tx) => service.syncUnlockedPerks(tx, personId));
        expect(affected).toContain(existingId);

        const rows = yield* findUnlockedPerks(personId);
        const expired = rows.find((row) => row.id === existingId);
        expect(expired?.status).toBe(PersonUnlockedPerkStatus.Expired);
      }),
    ).pipe(Effect.provide(PerkGrantService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "is a no-op when an active subscription grant already matches the desired state",
    withGraphCleanup((created) =>
      Effect.gen(function* () {
        const service = yield* PerkGrantService;
        const { configurationProductId, perkId, personId } = yield* seedEntitlementGraph(
          created,
          "noop",
        );
        const nowMillis = yield* Clock.currentTimeMillis;
        const expiresAt = dateAtMillis(nowMillis + 10 * 24 * 60 * 60 * 1000);
        const subscriptionId = yield* seedSubscription(created, {
          configurationProductId,
          expiresAt,
          personId,
          status: SubscriptionStatus.Active,
        });
        const existingId = yield* seedUnlockedPerk(created, {
          expiresAt,
          perkId,
          personId,
          status: PersonUnlockedPerkStatus.Active,
          unlockedBySubscriptionId: subscriptionId,
        });

        const affected = yield* inTransaction((tx) => service.syncUnlockedPerks(tx, personId));
        expect(affected.length).toBe(0);

        const rows = yield* findUnlockedPerks(personId);
        const unchanged = rows.find((row) => row.id === existingId);
        expect(unchanged?.status).toBe(PersonUnlockedPerkStatus.Active);
        expect(unchanged?.unlockedBySubscriptionId).toBe(subscriptionId);
      }),
    ).pipe(Effect.provide(PerkGrantService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "expires lingering grants for a person whose entitlements have all gone away",
    withGraphCleanup((created) =>
      Effect.gen(function* () {
        const service = yield* PerkGrantService;
        const { perkId, personId } = yield* seedEntitlementGraph(created, "empty");
        // Person has a stale active grant but no subscriptions or purchases.
        const existingId = yield* seedUnlockedPerk(created, {
          perkId,
          personId,
          status: PersonUnlockedPerkStatus.Active,
          unlockedByPurchaseId: "pur_stale_reference",
        });

        const affected = yield* inTransaction((tx) => service.syncUnlockedPerks(tx, personId));
        expect(affected).toContain(existingId);

        const rows = yield* findUnlockedPerks(personId);
        const expired = rows.find((row) => row.id === existingId);
        expect(expired?.status).toBe(PersonUnlockedPerkStatus.Expired);
      }),
    ).pipe(Effect.provide(PerkGrantService.layer), CoreAuthSession.authenticate()),
  );
});

describe("PerkGrantService.getPersonUnlockedPerks", () => {
  test(
    "returns all unlocked perks for the person",
    withGraphCleanup((created) =>
      Effect.gen(function* () {
        const service = yield* PerkGrantService;
        const { perkId, personId } = yield* seedEntitlementGraph(created, "get");
        const grantId = yield* seedUnlockedPerk(created, {
          perkId,
          personId,
          status: PersonUnlockedPerkStatus.Active,
          unlockedByPurchaseId: "pur_get_reference",
        });

        const result = yield* service.getPersonUnlockedPerks(personId);
        expect(result.some((row) => row.id === grantId && row.perkId === perkId)).toBe(true);
      }),
    ).pipe(Effect.provide(PerkGrantService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all for the person's project",
    withGraphCleanup((created) =>
      Effect.gen(function* () {
        const service = yield* PerkGrantService;
        const { personId } = yield* seedEntitlementGraph(created, "get-forbidden");

        const error = yield* Effect.flip(asUnauthorized(service.getPersonUnlockedPerks(personId)));
        expect(error).toBeInstanceOf(ActionForbiddenError);
      }),
    ).pipe(Effect.provide(PerkGrantService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "fails with PersonNotFoundError for an unknown person id",
    // No cleanup wrapper: a not-found lookup writes nothing.
    Effect.gen(function* () {
      const service = yield* PerkGrantService;
      const missingId = `person_missing_${yield* Clock.currentTimeMillis}`;

      const error = yield* Effect.flip(service.getPersonUnlockedPerks(missingId));
      expect(error).toBeInstanceOf(PersonNotFoundError);
      if (error instanceof PersonNotFoundError) {
        expect(error.id).toBe(missingId);
      }
    }).pipe(Effect.provide(PerkGrantService.layer), CoreAuthSession.authenticate()),
  );
});
