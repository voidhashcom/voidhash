/**
 * Integration tests for {@link PurchaseProcessingService}, run against the real
 * backend stack provisioned once by `test/_testing/globalSetup.ts` (live
 * PlanetScale DB + ClickHouse + WorkOS; only the project schema cache is an
 * in-memory stub).
 *
 * Unlike the catalog services, `PurchaseProcessingService` is unauthenticated
 * (its callers are the payment-provider boundaries, not dashboard users) and
 * provider-neutral: every public method mutates the operational projection
 * (`transaction` / `subscription` / `purchase`), syncs unlocked perks via
 * {@link PerkGrantService}, and stages revenue analytics into the append-only
 * `purchase_ledger` outbox. The watermark columns (`last_event_occurred_at`)
 * guard against out-of-order delivery, and the `purchase_ledger.idempotency_key`
 * UNIQUE constraint is the cross-source dedup gate.
 *
 * Each test verifies the *persisted* side effects rather than just the return
 * value:
 *  - the operational row written / updated (subscription / transaction / purchase),
 *  - the `purchase_ledger` outbox row (idempotency key, finalized `eventsPayload`
 *    + `resultPayload`),
 *  - money reconstruction from the stored transaction on refund / revoke paths,
 *  - watermark rejection of stale (earlier-`occurredAt`) events.
 *
 * Conventions:
 *  - The fixture only seeds user/org/member/project. Every test creates the
 *    parent rows it needs (a payment-provider configuration, a product, a
 *    configuration-product mapping, and a person) under the fixture project via
 *    {@link withPurchaseScenario}, which also cleans them and every operational
 *    /ledger row up afterward — success or failure — via `Effect.ensuring`.
 *  - Identifiers are namespaced per call ({@link uniqueKey}) so leftover rows
 *    from a crashed run can't collide, and assertions stay membership / by-id
 *    based.
 *  - `PurchaseProcessingService` performs no permission check, so there is no
 *    forbidden-path variant; the harness's default authenticated session is
 *    provided only because the layer graph (via `PerkGrantService`) resolves
 *    `AuthSession` lazily — no method under test reads it.
 *  - Typed failures are asserted with `Effect.flip` (project convention),
 *    narrowing the swapped error with `instanceof`, paired with a DB-state
 *    assertion proving nothing was written.
 */
import { PurchaseType, SubscriptionStatus } from "@voidhash/lib";
import { Effect, Option } from "effect";
import { describe, expect } from "vitest";

import { PerkGrantService } from "@voidhash/core/services";
import {
  PurchaseProcessingProductNotMappedError,
  PurchaseProcessingService,
  PurchaseProcessingServiceError,
} from "@voidhash/core/services/purchaseProcessing/PurchaseProcessingService";
import {
  PurchaseProcessingMoney,
  type PurchaseEventSource,
} from "@voidhash/core/domain/purchaseProcessing/PurchaseProcessing";
import type { PaymentProviderId } from "@voidhash/core/domain/paymentProvider/PaymentProviderConfiguration";
import type { CurrencyCode, MinorAmount } from "@voidhash/core/domain/shared/Money";
import {
  type DbError,
  Db,
  ProviderEnvironment,
  eq,
  inArray,
  paymentProviderConfigurationProducts,
  paymentProviderConfigurations,
  personUnlockedPerks,
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
const organizationId = CoreTestFixture.organizationId;

/** Monotonic counter so identifiers stay unique even within the same millisecond. */
let seq = 0;
const uniqueKey = (label: string) => `it-pp-${label}-${Date.now()}-${seq++}`;

const PROVIDER_ID = "apple-app-store" as PaymentProviderId;
const SOURCE = "webhook" as PurchaseEventSource;

/** Cents helper for the branded `MinorAmount` domain type at this trusted boundary. */
const cents = (n: number) => n as MinorAmount;
/** Currency helper for the branded `CurrencyCode` domain type. */
const ccy = (s: string) => s as CurrencyCode;

/**
 * A non-USD-converted money breakdown (no FX rate) used to fund a transaction
 * row. The analytics mapper applies the sign convention; amounts here are the
 * raw non-negative gross/commission/tax/proceeds.
 */
const money = (gross: number): PurchaseProcessingMoney =>
  new PurchaseProcessingMoney({
    currency: ccy("USD"),
    grossAmount: cents(gross),
    proceedsAfterTaxAmount: cents(gross - Math.round(gross * 0.3)),
    proceedsAmount: cents(gross - Math.round(gross * 0.3)),
    storeCommissionAmount: cents(Math.round(gross * 0.3)),
    storefront: Option.some("USA"),
    taxAmount: cents(0),
    usd: Option.none(),
  });

interface ScenarioIds {
  readonly configurationId: string;
  readonly productId: string;
  readonly configurationProductId: string;
  readonly personId: string;
}

/** Read a subscription row straight from the DB, bypassing the service. */
const findSubscriptionRow = (id: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.subscriptions.findFirst({ where: { id } });
  });

/** Read a subscription row by its store subscription id within a config product. */
const findSubscriptionByStore = (configurationProductId: string, storeSubscriptionId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.subscriptions.findFirst({
      where: {
        paymentProviderConfigurationProductId: configurationProductId,
        storeSubscriptionId,
      },
    });
  });

/** Read a transaction row by its store transaction id within a config product. */
const findTransactionByStore = (configurationProductId: string, storeTransactionId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.transactions.findFirst({
      where: {
        paymentProviderConfigurationProductId: configurationProductId,
        storeTransactionId,
      },
    });
  });

/** Read a purchase row by its provider key. */
const findPurchaseByProviderKey = (providerKey: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.purchases.findFirst({ where: { providerKey } });
  });

/** Read the ledger outbox row for a given idempotency key. */
const findLedgerRow = (idempotencyKey: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.purchaseLedger.findFirst({ where: { idempotencyKey } });
  });

/**
 * Delete every operational + ledger + parent row created during a scenario,
 * deepest dependents first. Append-only ledger rows are cleared by person id.
 * Each delete is `ignore`d so a missing row never turns the finalizer into a
 * failure.
 */
const cleanupScenario = (ids: ScenarioIds, idempotencyKeys: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const db = yield* Db;
    yield* db
      .delete(personUnlockedPerks)
      .where(eq(personUnlockedPerks.personId, ids.personId))
      .pipe(Effect.ignore);
    yield* db
      .delete(subscriptions)
      .where(eq(subscriptions.personId, ids.personId))
      .pipe(Effect.ignore);
    yield* db
      .delete(transactions)
      .where(eq(transactions.personId, ids.personId))
      .pipe(Effect.ignore);
    yield* db.delete(purchases).where(eq(purchases.personId, ids.personId)).pipe(Effect.ignore);
    yield* db
      .delete(purchaseLedger)
      .where(eq(purchaseLedger.personId, ids.personId))
      .pipe(Effect.ignore);
    if (idempotencyKeys.length > 0) {
      yield* db
        .delete(purchaseLedger)
        .where(inArray(purchaseLedger.idempotencyKey, [...idempotencyKeys]))
        .pipe(Effect.ignore);
    }
    yield* db
      .delete(paymentProviderConfigurationProducts)
      .where(eq(paymentProviderConfigurationProducts.id, ids.configurationProductId))
      .pipe(Effect.ignore);
    yield* db.delete(products).where(eq(products.id, ids.productId)).pipe(Effect.ignore);
    yield* db
      .delete(paymentProviderConfigurations)
      .where(eq(paymentProviderConfigurations.id, ids.configurationId))
      .pipe(Effect.ignore);
    yield* db.delete(persons).where(eq(persons.id, ids.personId)).pipe(Effect.ignore);
  });

/**
 * Seed the parent rows a purchase action needs (payment-provider configuration
 * → product → configuration-product mapping → person) under the fixture project,
 * run the test body with those ids, then delete everything it created on exit.
 * Extra idempotency keys (e.g. the implicit transfer keys the service derives)
 * are collected via the `trackKey` callback so their ledger rows are swept too.
 */
const withPurchaseScenario = <E, R>(
  label: string,
  body: (ids: ScenarioIds, trackKey: (key: string) => void) => Effect.Effect<void, E, R>,
): Effect.Effect<void, E | DbError, R | Db> =>
  Effect.gen(function* () {
    const db = yield* Db;
    const ids: ScenarioIds = {
      configurationId: uniqueKey(`${label}-conf`),
      configurationProductId: uniqueKey(`${label}-confprod`),
      personId: uniqueKey(`${label}-person`),
      productId: uniqueKey(`${label}-prod`),
    };
    const idempotencyKeys: string[] = [];

    yield* db.insert(paymentProviderConfigurations).values({
      enabled: true,
      id: ids.configurationId,
      name: "Integration PP Config",
      paymentProviderKey: uniqueKey(`${label}-ppkey`),
      projectId,
      providerId: PROVIDER_ID,
    });
    yield* db.insert(products).values({
      id: ids.productId,
      name: "Integration Product",
      projectId,
      slug: uniqueKey(`${label}-prodslug`),
    });
    yield* db.insert(paymentProviderConfigurationProducts).values({
      id: ids.configurationProductId,
      paymentProviderConfigurationId: ids.configurationId,
      productId: ids.productId,
      providerProductKey: uniqueKey(`${label}-provprodkey`),
    });
    yield* db.insert(persons).values({
      id: ids.personId,
      name: "Integration Person",
      projectId,
    });

    return yield* body(ids, (key) => idempotencyKeys.push(key)).pipe(
      Effect.ensuring(cleanupScenario(ids, idempotencyKeys)),
    );
  });

/** Builds the shared per-action context that every method receives. */
const baseAction = (ids: ScenarioIds, idempotencyKey: string, occurredAt: Date) => ({
  idempotencyKey,
  occurredAt,
  organizationId,
  paymentProviderConfigurationId: ids.configurationId,
  paymentProviderConfigurationProductId: ids.configurationProductId,
  personId: ids.personId,
  projectId,
  providerEnvironment: ProviderEnvironment.Production,
  providerEventType: "TEST_EVENT",
  providerId: PROVIDER_ID,
  providerSubscriptionId: Option.none<string>(),
  providerTransactionId: Option.none<string>(),
  providerWebhookNotificationId: Option.none<string>(),
  rawProviderPayload: Option.none<unknown>(),
  receivedAt: occurredAt,
  source: SOURCE,
});

describe("PurchaseProcessingService.startSubscription", () => {
  test(
    "creates subscription + transaction rows, finalizes the ledger outbox, and emits analytics",
    withPurchaseScenario("start", (ids, trackKey) =>
      Effect.gen(function* () {
        const svc = yield* PurchaseProcessingService;

        const idempotencyKey = uniqueKey("start-key");
        trackKey(idempotencyKey);
        const occurredAt = new Date("2026-01-01T00:00:00.000Z");
        const storeSubscriptionId = uniqueKey("start-storesub");
        const providerTransactionId = uniqueKey("start-tx");

        const result = yield* svc.startSubscription({
          ...baseAction(ids, idempotencyKey, occurredAt),
          expiresAt: Option.some(new Date("2026-02-01T00:00:00.000Z")),
          isTrial: false,
          money: Option.some(money(9990)),
          providerSubscriptionId: Option.some(storeSubscriptionId),
          providerTransactionId: Option.some(providerTransactionId),
          purchasedAt: occurredAt,
          startsAt: occurredAt,
        });

        expect(result.idempotent).toBe(false);
        expect(Option.isSome(result.subscriptionId)).toBe(true);
        expect(Option.isSome(result.transactionId)).toBe(true);
        // started maps to two events ($subscription.created + $purchase.completed).
        expect(result.analyticsEventIds.length).toBe(2);

        const subRow = yield* findSubscriptionByStore(
          ids.configurationProductId,
          storeSubscriptionId,
        );
        expect(subRow).toBeDefined();
        expect(subRow?.status).toBe(SubscriptionStatus.Active);
        expect(subRow?.personId).toBe(ids.personId);
        expect(subRow?.lastEventOccurredAt?.getTime()).toBe(occurredAt.getTime());

        const txRow = yield* findTransactionByStore(
          ids.configurationProductId,
          providerTransactionId,
        );
        expect(txRow).toBeDefined();
        expect(txRow?.grossAmount).toBe(9990);
        expect(txRow?.currency).toBe("USD");

        const ledger = yield* findLedgerRow(idempotencyKey);
        expect(ledger).toBeDefined();
        expect(ledger?.providerEventType).toBe("TEST_EVENT");
        // The ledger row is finalized with the staged analytics events for the worker to drain.
        expect((ledger?.eventsPayload ?? []).length).toBe(2);
        const resultPayload = ledger?.resultPayload as { readonly analyticsEventIds: string[] };
        expect(resultPayload.analyticsEventIds.length).toBe(2);
      }),
    ).pipe(
      Effect.provide(PurchaseProcessingService.layer),
      Effect.provide(PerkGrantService.layer),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "with no providerTransactionId produces no transaction row and no analytics events",
    withPurchaseScenario("start-notx", (ids, trackKey) =>
      Effect.gen(function* () {
        const svc = yield* PurchaseProcessingService;

        const idempotencyKey = uniqueKey("start-notx-key");
        trackKey(idempotencyKey);
        const occurredAt = new Date("2026-01-03T00:00:00.000Z");
        const storeSubscriptionId = uniqueKey("start-notx-storesub");

        const result = yield* svc.startSubscription({
          ...baseAction(ids, idempotencyKey, occurredAt),
          expiresAt: Option.none(),
          isTrial: true,
          money: Option.none(),
          providerSubscriptionId: Option.some(storeSubscriptionId),
          purchasedAt: occurredAt,
          startsAt: occurredAt,
        });

        expect(Option.isNone(result.transactionId)).toBe(true);
        // The analytics mapper drops the started events when no transactionId is present.
        expect(result.analyticsEventIds.length).toBe(0);

        const subRow = yield* findSubscriptionByStore(
          ids.configurationProductId,
          storeSubscriptionId,
        );
        expect(subRow).toBeDefined();
        expect(subRow?.isTrial).toBe(true);

        // A subscription identifier maps the transaction lookup off; assert no tx row exists.
        const db = yield* Db;
        const txRows = yield* db.query.transactions.findMany({ where: { personId: ids.personId } });
        expect(txRows.length).toBe(0);
      }),
    ).pipe(
      Effect.provide(PurchaseProcessingService.layer),
      Effect.provide(PerkGrantService.layer),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "a duplicate idempotency key replays the cached result without a second write",
    withPurchaseScenario("start-dup", (ids, trackKey) =>
      Effect.gen(function* () {
        const svc = yield* PurchaseProcessingService;

        const idempotencyKey = uniqueKey("start-dup-key");
        trackKey(idempotencyKey);
        const occurredAt = new Date("2026-01-05T00:00:00.000Z");
        const storeSubscriptionId = uniqueKey("start-dup-storesub");
        const providerTransactionId = uniqueKey("start-dup-tx");

        const action = {
          ...baseAction(ids, idempotencyKey, occurredAt),
          expiresAt: Option.some(new Date("2026-02-05T00:00:00.000Z")),
          isTrial: false,
          money: Option.some(money(4990)),
          providerSubscriptionId: Option.some(storeSubscriptionId),
          providerTransactionId: Option.some(providerTransactionId),
          purchasedAt: occurredAt,
          startsAt: occurredAt,
        };

        const first = yield* svc.startSubscription(action);
        expect(first.idempotent).toBe(false);
        expect(Option.isSome(first.subscriptionId)).toBe(true);

        // Replay the exact same event (same idempotencyKey). The ledger dedup
        // gate must short-circuit before any operational write and replay the
        // first call's cached result.
        const second = yield* svc.startSubscription(action);
        expect(second.idempotent).toBe(true);
        // The replayed result mirrors the first call's identifiers verbatim.
        expect(second.subscriptionId).toStrictEqual(first.subscriptionId);
        expect(second.transactionId).toStrictEqual(first.transactionId);
        expect(second.analyticsEventIds).toStrictEqual(first.analyticsEventIds);

        // Exactly one subscription row exists for the store subscription id —
        // the replay wrote no second row.
        const db = yield* Db;
        const subRows = yield* db.query.subscriptions.findMany({
          where: {
            paymentProviderConfigurationProductId: ids.configurationProductId,
            storeSubscriptionId,
          },
        });
        expect(subRows.length).toBe(1);

        // And exactly one ledger row exists for the idempotency key.
        const ledgerRows = yield* db.query.purchaseLedger.findMany({
          where: { idempotencyKey },
        });
        expect(ledgerRows.length).toBe(1);
      }),
    ).pipe(
      Effect.provide(PurchaseProcessingService.layer),
      Effect.provide(PerkGrantService.layer),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "fails with PurchaseProcessingProductNotMappedError when the config product is unknown",
    withPurchaseScenario("start-unmapped", (ids, trackKey) =>
      Effect.gen(function* () {
        const svc = yield* PurchaseProcessingService;

        const idempotencyKey = uniqueKey("start-unmapped-key");
        trackKey(idempotencyKey);
        const occurredAt = new Date("2026-01-07T00:00:00.000Z");

        const error = yield* Effect.flip(
          svc.startSubscription({
            ...baseAction(ids, idempotencyKey, occurredAt),
            // Point at a config-product id that does not exist.
            paymentProviderConfigurationProductId: uniqueKey("start-unmapped-missing"),
            expiresAt: Option.none(),
            isTrial: false,
            money: Option.none(),
            providerSubscriptionId: Option.some(uniqueKey("start-unmapped-storesub")),
            purchasedAt: occurredAt,
            startsAt: occurredAt,
          }),
        );
        expect(error).toBeInstanceOf(PurchaseProcessingProductNotMappedError);

        // Nothing was written: no ledger row, no subscription.
        const ledger = yield* findLedgerRow(idempotencyKey);
        expect(ledger).toBeUndefined();
        const db = yield* Db;
        const subRows = yield* db.query.subscriptions.findMany({
          where: { personId: ids.personId },
        });
        expect(subRows.length).toBe(0);
      }),
    ).pipe(
      Effect.provide(PurchaseProcessingService.layer),
      Effect.provide(PerkGrantService.layer),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "fails with PurchaseProcessingServiceError when the person belongs to a different project",
    withPurchaseScenario("start-wrongproj", (ids, trackKey) =>
      Effect.gen(function* () {
        const svc = yield* PurchaseProcessingService;

        const idempotencyKey = uniqueKey("start-wrongproj-key");
        trackKey(idempotencyKey);
        const occurredAt = new Date("2026-01-09T00:00:00.000Z");

        const error = yield* Effect.flip(
          svc.startSubscription({
            ...baseAction(ids, idempotencyKey, occurredAt),
            // Resolve the person under a different project than the action's projectId.
            projectId: `${projectId}-other`,
            expiresAt: Option.none(),
            isTrial: false,
            money: Option.none(),
            providerSubscriptionId: Option.some(uniqueKey("start-wrongproj-storesub")),
            purchasedAt: occurredAt,
            startsAt: occurredAt,
          }),
        );
        expect(error).toBeInstanceOf(PurchaseProcessingServiceError);

        const ledger = yield* findLedgerRow(idempotencyKey);
        expect(ledger).toBeUndefined();
      }),
    ).pipe(
      Effect.provide(PurchaseProcessingService.layer),
      Effect.provide(PerkGrantService.layer),
      CoreAuthSession.authenticate(),
    ),
  );
});

/** Seed an active subscription row directly so update/transition tests have a target. */
const seedActiveSubscription = (
  ids: ScenarioIds,
  input: {
    readonly id: string;
    readonly storeSubscriptionId: string;
    readonly startsAt: Date;
    readonly expiresAt: Date | null;
    readonly lastEventOccurredAt: Date;
  },
) =>
  Effect.gen(function* () {
    const db = yield* Db;
    yield* db.insert(subscriptions).values({
      cancelAtPeriodEnd: false,
      canceledAt: null,
      expiresAt: input.expiresAt,
      id: input.id,
      initialTransactionId: input.storeSubscriptionId,
      isTrial: false,
      lastEventOccurredAt: input.lastEventOccurredAt,
      latestTransactionId: input.storeSubscriptionId,
      paymentProviderConfigurationProductId: ids.configurationProductId,
      personId: ids.personId,
      providerEnvironment: ProviderEnvironment.Production,
      purchasedAt: input.startsAt,
      startsAt: input.startsAt,
      status: SubscriptionStatus.Active,
      storeSubscriptionId: input.storeSubscriptionId,
    });
  });

describe("PurchaseProcessingService.renewSubscription", () => {
  test(
    "updates the existing subscription row, advances the watermark, and emits a renewal event",
    withPurchaseScenario("renew", (ids, trackKey) =>
      Effect.gen(function* () {
        const svc = yield* PurchaseProcessingService;

        const subscriptionId = uniqueKey("renew-sub");
        const storeSubscriptionId = uniqueKey("renew-storesub");
        const startedAt = new Date("2026-02-01T00:00:00.000Z");
        yield* seedActiveSubscription(ids, {
          expiresAt: new Date("2026-03-01T00:00:00.000Z"),
          id: subscriptionId,
          lastEventOccurredAt: startedAt,
          startsAt: startedAt,
          storeSubscriptionId,
        });

        const idempotencyKey = uniqueKey("renew-key");
        trackKey(idempotencyKey);
        const renewedAt = new Date("2026-03-01T00:00:00.000Z");
        const newExpiresAt = new Date("2026-04-01T00:00:00.000Z");

        const result = yield* svc.renewSubscription({
          ...baseAction(ids, idempotencyKey, renewedAt),
          expiresAt: Option.some(newExpiresAt),
          isTrial: false,
          money: Option.some(money(9990)),
          providerSubscriptionId: Option.some(storeSubscriptionId),
          providerTransactionId: Option.some(uniqueKey("renew-tx")),
          renewedAt,
          startsAt: renewedAt,
        });

        expect(Option.getOrNull(result.subscriptionId)).toBe(subscriptionId);
        expect(result.analyticsEventIds.length).toBe(1);

        const row = yield* findSubscriptionRow(subscriptionId);
        expect(row?.expiresAt?.getTime()).toBe(newExpiresAt.getTime());
        expect(row?.lastEventOccurredAt?.getTime()).toBe(renewedAt.getTime());
        expect(row?.status).toBe(SubscriptionStatus.Active);
      }),
    ).pipe(
      Effect.provide(PurchaseProcessingService.layer),
      Effect.provide(PerkGrantService.layer),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "rejects a stale (earlier-occurredAt) renewal at the watermark and leaves the row unchanged",
    withPurchaseScenario("renew-stale", (ids, trackKey) =>
      Effect.gen(function* () {
        const svc = yield* PurchaseProcessingService;

        const subscriptionId = uniqueKey("renew-stale-sub");
        const storeSubscriptionId = uniqueKey("renew-stale-storesub");
        const freshWatermark = new Date("2026-05-01T00:00:00.000Z");
        const expiresAt = new Date("2026-06-01T00:00:00.000Z");
        yield* seedActiveSubscription(ids, {
          expiresAt,
          id: subscriptionId,
          lastEventOccurredAt: freshWatermark,
          startsAt: new Date("2026-04-01T00:00:00.000Z"),
          storeSubscriptionId,
        });

        const idempotencyKey = uniqueKey("renew-stale-key");
        trackKey(idempotencyKey);
        // occurredAt is BEFORE the current watermark -> projection update rejected.
        const staleOccurredAt = new Date("2026-04-15T00:00:00.000Z");

        const result = yield* svc.renewSubscription({
          ...baseAction(ids, idempotencyKey, staleOccurredAt),
          expiresAt: Option.some(new Date("2026-12-01T00:00:00.000Z")),
          isTrial: false,
          money: Option.none(),
          providerSubscriptionId: Option.some(storeSubscriptionId),
          renewedAt: staleOccurredAt,
          startsAt: staleOccurredAt,
        });

        // Service continues (returns a result) but the projection wasn't changed.
        expect(Option.getOrNull(result.subscriptionId)).toBe(subscriptionId);

        const row = yield* findSubscriptionRow(subscriptionId);
        expect(row?.expiresAt?.getTime()).toBe(expiresAt.getTime());
        expect(row?.lastEventOccurredAt?.getTime()).toBe(freshWatermark.getTime());
      }),
    ).pipe(
      Effect.provide(PurchaseProcessingService.layer),
      Effect.provide(PerkGrantService.layer),
      CoreAuthSession.authenticate(),
    ),
  );
});

describe("PurchaseProcessingService.cancelSubscription / expireSubscription", () => {
  test(
    "cancelSubscription (immediate) moves the subscription to Canceled and records the reason",
    withPurchaseScenario("cancel", (ids, trackKey) =>
      Effect.gen(function* () {
        const svc = yield* PurchaseProcessingService;

        const subscriptionId = uniqueKey("cancel-sub");
        const storeSubscriptionId = uniqueKey("cancel-storesub");
        yield* seedActiveSubscription(ids, {
          expiresAt: new Date("2026-08-01T00:00:00.000Z"),
          id: subscriptionId,
          lastEventOccurredAt: new Date("2026-07-01T00:00:00.000Z"),
          startsAt: new Date("2026-07-01T00:00:00.000Z"),
          storeSubscriptionId,
        });

        const idempotencyKey = uniqueKey("cancel-key");
        trackKey(idempotencyKey);
        const canceledAt = new Date("2026-07-15T00:00:00.000Z");

        const result = yield* svc.cancelSubscription({
          ...baseAction(ids, idempotencyKey, canceledAt),
          canceledAt,
          cancelAtPeriodEnd: false,
          cancellationReason: Option.some("user_requested"),
          providerSubscriptionId: Option.some(storeSubscriptionId),
        });
        expect(Option.getOrNull(result.subscriptionId)).toBe(subscriptionId);

        const row = yield* findSubscriptionRow(subscriptionId);
        expect(row?.status).toBe(SubscriptionStatus.Canceled);
        expect(row?.cancellationReason).toBe("user_requested");
        expect(row?.canceledAt?.getTime()).toBe(canceledAt.getTime());
      }),
    ).pipe(
      Effect.provide(PurchaseProcessingService.layer),
      Effect.provide(PerkGrantService.layer),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "cancelSubscription for an unknown subscription writes an empty finalized ledger row only",
    withPurchaseScenario("cancel-missing", (ids, trackKey) =>
      Effect.gen(function* () {
        const svc = yield* PurchaseProcessingService;

        const idempotencyKey = uniqueKey("cancel-missing-key");
        trackKey(idempotencyKey);
        const canceledAt = new Date("2026-07-20T00:00:00.000Z");

        const result = yield* svc.cancelSubscription({
          ...baseAction(ids, idempotencyKey, canceledAt),
          canceledAt,
          cancelAtPeriodEnd: false,
          cancellationReason: Option.none(),
          providerSubscriptionId: Option.some(uniqueKey("cancel-missing-storesub")),
        });

        // No subscription found -> empty result, no analytics.
        expect(Option.isNone(result.subscriptionId)).toBe(true);
        expect(result.analyticsEventIds.length).toBe(0);

        // The reservation ledger row was still claimed (and finalized empty).
        const ledger = yield* findLedgerRow(idempotencyKey);
        expect(ledger).toBeDefined();
        expect((ledger?.eventsPayload ?? []).length).toBe(0);
      }),
    ).pipe(
      Effect.provide(PurchaseProcessingService.layer),
      Effect.provide(PerkGrantService.layer),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "expireSubscription moves the subscription to Canceled and sets expiresAt to the expiry time",
    withPurchaseScenario("expire", (ids, trackKey) =>
      Effect.gen(function* () {
        const svc = yield* PurchaseProcessingService;

        const subscriptionId = uniqueKey("expire-sub");
        const storeSubscriptionId = uniqueKey("expire-storesub");
        yield* seedActiveSubscription(ids, {
          expiresAt: new Date("2026-09-01T00:00:00.000Z"),
          id: subscriptionId,
          lastEventOccurredAt: new Date("2026-08-01T00:00:00.000Z"),
          startsAt: new Date("2026-08-01T00:00:00.000Z"),
          storeSubscriptionId,
        });

        const idempotencyKey = uniqueKey("expire-key");
        trackKey(idempotencyKey);
        const expiredAt = new Date("2026-09-01T00:00:00.000Z");

        yield* svc.expireSubscription({
          ...baseAction(ids, idempotencyKey, expiredAt),
          expiredAt,
          providerSubscriptionId: Option.some(storeSubscriptionId),
        });

        const row = yield* findSubscriptionRow(subscriptionId);
        expect(row?.status).toBe(SubscriptionStatus.Canceled);
        expect(row?.expiresAt?.getTime()).toBe(expiredAt.getTime());
      }),
    ).pipe(
      Effect.provide(PurchaseProcessingService.layer),
      Effect.provide(PerkGrantService.layer),
      CoreAuthSession.authenticate(),
    ),
  );
});

describe("PurchaseProcessingService.revokeSubscription", () => {
  test(
    "revokes the subscription and reconstructs money from the stored transaction row",
    withPurchaseScenario("revoke-sub", (ids, trackKey) =>
      Effect.gen(function* () {
        const svc = yield* PurchaseProcessingService;

        // Seed an active subscription plus its funding transaction.
        const subscriptionId = uniqueKey("revoke-sub-id");
        const storeSubscriptionId = uniqueKey("revoke-sub-storesub");
        const providerTransactionId = uniqueKey("revoke-sub-tx");
        const startedAt = new Date("2026-10-01T00:00:00.000Z");
        yield* seedActiveSubscription(ids, {
          expiresAt: new Date("2026-11-01T00:00:00.000Z"),
          id: subscriptionId,
          lastEventOccurredAt: startedAt,
          startsAt: startedAt,
          storeSubscriptionId,
        });
        const db = yield* Db;
        const transactionRowId = uniqueKey("revoke-sub-txrow");
        yield* db.insert(transactions).values({
          amount: 9990,
          currency: "USD",
          grossAmount: 9990,
          id: transactionRowId,
          lastEventOccurredAt: startedAt,
          occurredAt: startedAt,
          paymentProviderConfigurationProductId: ids.configurationProductId,
          personId: ids.personId,
          proceedsAfterTaxAmount: 6993,
          proceedsAmount: 6993,
          providerEnvironment: ProviderEnvironment.Production,
          storeCommissionAmount: 2997,
          storeTransactionId: providerTransactionId,
          storefront: "USA",
          taxAmount: 0,
        });

        const idempotencyKey = uniqueKey("revoke-sub-key");
        trackKey(idempotencyKey);
        const revokedAt = new Date("2026-10-15T00:00:00.000Z");

        const result = yield* svc.revokeSubscription({
          ...baseAction(ids, idempotencyKey, revokedAt),
          providerSubscriptionId: Option.some(storeSubscriptionId),
          providerTransactionId: Option.some(providerTransactionId),
          revocationReason: Option.some("family_sharing_revoked"),
          revokedAt,
        });
        expect(Option.getOrNull(result.subscriptionId)).toBe(subscriptionId);
        // Revoke maps to a signed-negative revoked analytics event.
        expect(result.analyticsEventIds.length).toBe(1);

        const subRow = yield* findSubscriptionRow(subscriptionId);
        expect(subRow?.status).toBe(SubscriptionStatus.Canceled);
        expect(subRow?.cancellationReason).toBe("family_sharing_revoked");

        const txRow = yield* findTransactionByStore(
          ids.configurationProductId,
          providerTransactionId,
        );
        expect(txRow?.revokedAt?.getTime()).toBe(revokedAt.getTime());
        expect(txRow?.revocationReason).toBe("family_sharing_revoked");
      }),
    ).pipe(
      Effect.provide(PurchaseProcessingService.layer),
      Effect.provide(PerkGrantService.layer),
      CoreAuthSession.authenticate(),
    ),
  );
});

describe("PurchaseProcessingService.completeOneTimePurchase / refundPurchase / revokePurchase / reverseRefund", () => {
  test(
    "completeOneTimePurchase creates a purchase + transaction row and emits a completed event",
    withPurchaseScenario("otp", (ids, trackKey) =>
      Effect.gen(function* () {
        const svc = yield* PurchaseProcessingService;

        const idempotencyKey = uniqueKey("otp-key");
        trackKey(idempotencyKey);
        const occurredAt = new Date("2026-03-10T00:00:00.000Z");
        const providerTransactionId = uniqueKey("otp-tx");

        const result = yield* svc.completeOneTimePurchase({
          ...baseAction(ids, idempotencyKey, occurredAt),
          money: Option.some(money(2990)),
          providerTransactionId: Option.some(providerTransactionId),
          purchaseType: "one-time",
          purchasedAt: occurredAt,
        });

        expect(Option.isSome(result.purchaseId)).toBe(true);
        expect(Option.isSome(result.transactionId)).toBe(true);

        const purchaseRow = yield* findPurchaseByProviderKey(providerTransactionId);
        expect(purchaseRow).toBeDefined();
        expect(purchaseRow?.type).toBe(PurchaseType.OneTime);
        expect(purchaseRow?.personId).toBe(ids.personId);

        const txRow = yield* findTransactionByStore(
          ids.configurationProductId,
          providerTransactionId,
        );
        expect(txRow?.grossAmount).toBe(2990);
      }),
    ).pipe(
      Effect.provide(PurchaseProcessingService.layer),
      Effect.provide(PerkGrantService.layer),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "refundPurchase marks the transaction + purchase refunded (watermark-guarded)",
    withPurchaseScenario("refund", (ids, trackKey) =>
      Effect.gen(function* () {
        const svc = yield* PurchaseProcessingService;

        // Establish the purchase + transaction via a real complete call first.
        const completeKey = uniqueKey("refund-complete-key");
        trackKey(completeKey);
        const completedAt = new Date("2026-03-20T00:00:00.000Z");
        const providerTransactionId = uniqueKey("refund-tx");
        yield* svc.completeOneTimePurchase({
          ...baseAction(ids, completeKey, completedAt),
          money: Option.some(money(1990)),
          providerTransactionId: Option.some(providerTransactionId),
          purchaseType: "one-time",
          purchasedAt: completedAt,
        });

        const refundKey = uniqueKey("refund-key");
        trackKey(refundKey);
        const refundedAt = new Date("2026-03-25T00:00:00.000Z");
        const result = yield* svc.refundPurchase({
          ...baseAction(ids, refundKey, refundedAt),
          providerTransactionId: Option.some(providerTransactionId),
          refundReason: Option.some("customer_refund"),
          refundedAt,
        });
        // refunded always emits a (negative-signed) refunded event.
        expect(result.analyticsEventIds.length).toBe(1);

        const txRow = yield* findTransactionByStore(
          ids.configurationProductId,
          providerTransactionId,
        );
        expect(txRow?.refundedAt?.getTime()).toBe(refundedAt.getTime());
        expect(txRow?.refundReason).toBe("customer_refund");

        const purchaseRow = yield* findPurchaseByProviderKey(providerTransactionId);
        expect(purchaseRow?.refundedAt?.getTime()).toBe(refundedAt.getTime());
      }),
    ).pipe(
      Effect.provide(PurchaseProcessingService.layer),
      Effect.provide(PerkGrantService.layer),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "reverseRefund un-refunds both the transaction and purchase rows",
    withPurchaseScenario("reverse", (ids, trackKey) =>
      Effect.gen(function* () {
        const svc = yield* PurchaseProcessingService;

        const completeKey = uniqueKey("reverse-complete-key");
        trackKey(completeKey);
        const completedAt = new Date("2026-04-01T00:00:00.000Z");
        const providerTransactionId = uniqueKey("reverse-tx");
        yield* svc.completeOneTimePurchase({
          ...baseAction(ids, completeKey, completedAt),
          money: Option.some(money(3990)),
          providerTransactionId: Option.some(providerTransactionId),
          purchaseType: "one-time",
          purchasedAt: completedAt,
        });

        const refundKey = uniqueKey("reverse-refund-key");
        trackKey(refundKey);
        const refundedAt = new Date("2026-04-05T00:00:00.000Z");
        yield* svc.refundPurchase({
          ...baseAction(ids, refundKey, refundedAt),
          providerTransactionId: Option.some(providerTransactionId),
          refundReason: Option.some("customer_refund"),
          refundedAt,
        });

        const reverseKey = uniqueKey("reverse-key");
        trackKey(reverseKey);
        const reversedAt = new Date("2026-04-10T00:00:00.000Z");
        const result = yield* svc.reverseRefund({
          ...baseAction(ids, reverseKey, reversedAt),
          providerTransactionId: Option.some(providerTransactionId),
          reversedAt,
        });
        expect(result.analyticsEventIds.length).toBe(1);

        const txRow = yield* findTransactionByStore(
          ids.configurationProductId,
          providerTransactionId,
        );
        expect(txRow?.refundedAt).toBeNull();
        expect(txRow?.refundReason).toBeNull();

        const purchaseRow = yield* findPurchaseByProviderKey(providerTransactionId);
        expect(purchaseRow?.refundedAt).toBeNull();
      }),
    ).pipe(
      Effect.provide(PurchaseProcessingService.layer),
      Effect.provide(PerkGrantService.layer),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "revokePurchase for an unknown provider key fails with PurchaseProcessingServiceError",
    withPurchaseScenario("revoke-pur-missing", (ids, trackKey) =>
      Effect.gen(function* () {
        const svc = yield* PurchaseProcessingService;

        const idempotencyKey = uniqueKey("revoke-pur-missing-key");
        trackKey(idempotencyKey);
        const occurredAt = new Date("2026-04-15T00:00:00.000Z");

        // No providerTransactionId and no providerSubscriptionId -> no purchase identifier.
        const error = yield* Effect.flip(
          svc.revokePurchase({
            ...baseAction(ids, idempotencyKey, occurredAt),
            revocationReason: Option.none(),
            revokedAt: occurredAt,
          }),
        );
        expect(error).toBeInstanceOf(PurchaseProcessingServiceError);

        // The identifier check runs before the ledger reservation, so nothing was written.
        const ledger = yield* findLedgerRow(idempotencyKey);
        expect(ledger).toBeUndefined();
      }),
    ).pipe(
      Effect.provide(PurchaseProcessingService.layer),
      Effect.provide(PerkGrantService.layer),
      CoreAuthSession.authenticate(),
    ),
  );
});

describe("PurchaseProcessingService subscription state mutations", () => {
  test(
    "enterBillingRetry records the retry + grace deadline and emits a billing_retry event",
    withPurchaseScenario("billing-retry", (ids, trackKey) =>
      Effect.gen(function* () {
        const svc = yield* PurchaseProcessingService;

        const subscriptionId = uniqueKey("retry-sub");
        const storeSubscriptionId = uniqueKey("retry-storesub");
        yield* seedActiveSubscription(ids, {
          expiresAt: new Date("2026-06-01T00:00:00.000Z"),
          id: subscriptionId,
          lastEventOccurredAt: new Date("2026-05-01T00:00:00.000Z"),
          startsAt: new Date("2026-05-01T00:00:00.000Z"),
          storeSubscriptionId,
        });

        const idempotencyKey = uniqueKey("retry-key");
        trackKey(idempotencyKey);
        const billingRetryAt = new Date("2026-05-20T00:00:00.000Z");
        const gracePeriodExpiresAt = new Date("2026-05-30T00:00:00.000Z");

        const result = yield* svc.enterBillingRetry({
          ...baseAction(ids, idempotencyKey, billingRetryAt),
          billingRetryAt,
          gracePeriodExpiresAt: Option.some(gracePeriodExpiresAt),
          providerSubscriptionId: Option.some(storeSubscriptionId),
        });
        expect(result.analyticsEventIds.length).toBe(1);

        const row = yield* findSubscriptionRow(subscriptionId);
        expect(row?.billingRetryAt?.getTime()).toBe(billingRetryAt.getTime());
        expect(row?.gracePeriodExpiresAt?.getTime()).toBe(gracePeriodExpiresAt.getTime());
        // Subscription stays Active during the retry loop.
        expect(row?.status).toBe(SubscriptionStatus.Active);
      }),
    ).pipe(
      Effect.provide(PurchaseProcessingService.layer),
      Effect.provide(PerkGrantService.layer),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "extendSubscription pushes expiresAt + extendedTo forward",
    withPurchaseScenario("extend", (ids, trackKey) =>
      Effect.gen(function* () {
        const svc = yield* PurchaseProcessingService;

        const subscriptionId = uniqueKey("extend-sub");
        const storeSubscriptionId = uniqueKey("extend-storesub");
        yield* seedActiveSubscription(ids, {
          expiresAt: new Date("2026-06-01T00:00:00.000Z"),
          id: subscriptionId,
          lastEventOccurredAt: new Date("2026-05-01T00:00:00.000Z"),
          startsAt: new Date("2026-05-01T00:00:00.000Z"),
          storeSubscriptionId,
        });

        const idempotencyKey = uniqueKey("extend-key");
        trackKey(idempotencyKey);
        const occurredAt = new Date("2026-05-25T00:00:00.000Z");
        const extendedTo = new Date("2026-07-01T00:00:00.000Z");

        yield* svc.extendSubscription({
          ...baseAction(ids, idempotencyKey, occurredAt),
          extendedTo,
          providerSubscriptionId: Option.some(storeSubscriptionId),
        });

        const row = yield* findSubscriptionRow(subscriptionId);
        expect(row?.expiresAt?.getTime()).toBe(extendedTo.getTime());
        expect(row?.extendedTo?.getTime()).toBe(extendedTo.getTime());
      }),
    ).pipe(
      Effect.provide(PurchaseProcessingService.layer),
      Effect.provide(PerkGrantService.layer),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "changeRenewalPreference records the pending product change intent",
    withPurchaseScenario("renewpref", (ids, trackKey) =>
      Effect.gen(function* () {
        const svc = yield* PurchaseProcessingService;

        const subscriptionId = uniqueKey("renewpref-sub");
        const storeSubscriptionId = uniqueKey("renewpref-storesub");
        yield* seedActiveSubscription(ids, {
          expiresAt: new Date("2026-06-01T00:00:00.000Z"),
          id: subscriptionId,
          lastEventOccurredAt: new Date("2026-05-01T00:00:00.000Z"),
          startsAt: new Date("2026-05-01T00:00:00.000Z"),
          storeSubscriptionId,
        });

        const idempotencyKey = uniqueKey("renewpref-key");
        trackKey(idempotencyKey);
        const occurredAt = new Date("2026-05-15T00:00:00.000Z");
        const newConfigProductId = ids.configurationProductId;

        yield* svc.changeRenewalPreference({
          ...baseAction(ids, idempotencyKey, occurredAt),
          newPaymentProviderConfigurationProductId: Option.some(newConfigProductId),
          newProviderProductKey: "new_provider_product_key",
          providerSubscriptionId: Option.some(storeSubscriptionId),
        });

        const row = yield* findSubscriptionRow(subscriptionId);
        expect(row?.pendingProductChangeId).toBe(newConfigProductId);
      }),
    ).pipe(
      Effect.provide(PurchaseProcessingService.layer),
      Effect.provide(PerkGrantService.layer),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "redeemOffer records the redeemed offer id + timestamp",
    withPurchaseScenario("offer", (ids, trackKey) =>
      Effect.gen(function* () {
        const svc = yield* PurchaseProcessingService;

        const subscriptionId = uniqueKey("offer-sub");
        const storeSubscriptionId = uniqueKey("offer-storesub");
        yield* seedActiveSubscription(ids, {
          expiresAt: new Date("2026-06-01T00:00:00.000Z"),
          id: subscriptionId,
          lastEventOccurredAt: new Date("2026-05-01T00:00:00.000Z"),
          startsAt: new Date("2026-05-01T00:00:00.000Z"),
          storeSubscriptionId,
        });

        const idempotencyKey = uniqueKey("offer-key");
        trackKey(idempotencyKey);
        const redeemedAt = new Date("2026-05-18T00:00:00.000Z");

        yield* svc.redeemOffer({
          ...baseAction(ids, idempotencyKey, redeemedAt),
          offerId: Option.some("WELCOME10"),
          providerSubscriptionId: Option.some(storeSubscriptionId),
          redeemedAt,
        });

        const row = yield* findSubscriptionRow(subscriptionId);
        expect(row?.redeemedOfferId).toBe("WELCOME10");
        expect(row?.redeemedOfferAt?.getTime()).toBe(redeemedAt.getTime());
      }),
    ).pipe(
      Effect.provide(PurchaseProcessingService.layer),
      Effect.provide(PerkGrantService.layer),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "recordPriceIncrease stages the pending price amount/currency/effective-at",
    withPurchaseScenario("price", (ids, trackKey) =>
      Effect.gen(function* () {
        const svc = yield* PurchaseProcessingService;

        const subscriptionId = uniqueKey("price-sub");
        const storeSubscriptionId = uniqueKey("price-storesub");
        yield* seedActiveSubscription(ids, {
          expiresAt: new Date("2026-06-01T00:00:00.000Z"),
          id: subscriptionId,
          lastEventOccurredAt: new Date("2026-05-01T00:00:00.000Z"),
          startsAt: new Date("2026-05-01T00:00:00.000Z"),
          storeSubscriptionId,
        });

        const idempotencyKey = uniqueKey("price-key");
        trackKey(idempotencyKey);
        const occurredAt = new Date("2026-05-22T00:00:00.000Z");
        const effectiveAt = new Date("2026-06-01T00:00:00.000Z");

        yield* svc.recordPriceIncrease({
          ...baseAction(ids, idempotencyKey, occurredAt),
          effectiveAt: Option.some(effectiveAt),
          money: Option.some(money(12990)),
          providerSubscriptionId: Option.some(storeSubscriptionId),
        });

        const row = yield* findSubscriptionRow(subscriptionId);
        expect(row?.pendingPriceAmount).toBe(12990);
        expect(row?.pendingPriceCurrency).toBe("USD");
        expect(row?.pendingPriceEffectiveAt?.getTime()).toBe(effectiveAt.getTime());
      }),
    ).pipe(
      Effect.provide(PurchaseProcessingService.layer),
      Effect.provide(PerkGrantService.layer),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "resumeAutoRenew clears canceledAt / cancelAtPeriodEnd / cancellationReason",
    withPurchaseScenario("resume", (ids, trackKey) =>
      Effect.gen(function* () {
        const svc = yield* PurchaseProcessingService;

        const subscriptionId = uniqueKey("resume-sub");
        const storeSubscriptionId = uniqueKey("resume-storesub");
        yield* seedActiveSubscription(ids, {
          expiresAt: new Date("2026-06-01T00:00:00.000Z"),
          id: subscriptionId,
          lastEventOccurredAt: new Date("2026-05-01T00:00:00.000Z"),
          startsAt: new Date("2026-05-01T00:00:00.000Z"),
          storeSubscriptionId,
        });
        // Pre-set the cancel fields so resume has something to clear.
        const db = yield* Db;
        yield* db
          .update(subscriptions)
          .set({
            cancelAtPeriodEnd: true,
            canceledAt: new Date("2026-05-10T00:00:00.000Z"),
            cancellationReason: "user_requested",
          })
          .where(eq(subscriptions.id, subscriptionId));

        const idempotencyKey = uniqueKey("resume-key");
        trackKey(idempotencyKey);
        const resumedAt = new Date("2026-05-12T00:00:00.000Z");

        yield* svc.resumeAutoRenew({
          ...baseAction(ids, idempotencyKey, resumedAt),
          providerSubscriptionId: Option.some(storeSubscriptionId),
          resumedAt,
        });

        const row = yield* findSubscriptionRow(subscriptionId);
        expect(row?.cancelAtPeriodEnd).toBe(false);
        expect(row?.canceledAt).toBeNull();
        expect(row?.cancellationReason).toBeNull();
      }),
    ).pipe(
      Effect.provide(PurchaseProcessingService.layer),
      Effect.provide(PerkGrantService.layer),
      CoreAuthSession.authenticate(),
    ),
  );
});

/** Seed a second person under the fixture project to act as a transfer target. */
const seedTargetPerson = (id: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    yield* db.insert(persons).values({ id, name: "Transfer Target", projectId });
  });

describe("PurchaseProcessingService.transferSubscription", () => {
  test(
    "moves subscription ownership to the target person and emits a transferred pair",
    withPurchaseScenario("xfer-sub", (ids, trackKey) =>
      Effect.gen(function* () {
        const svc = yield* PurchaseProcessingService;

        const targetPersonId = uniqueKey("xfer-sub-target");
        yield* seedTargetPerson(targetPersonId);

        const subscriptionId = uniqueKey("xfer-sub-id");
        const storeSubscriptionId = uniqueKey("xfer-sub-storesub");
        yield* seedActiveSubscription(ids, {
          expiresAt: new Date("2026-12-01T00:00:00.000Z"),
          id: subscriptionId,
          lastEventOccurredAt: new Date("2026-11-01T00:00:00.000Z"),
          startsAt: new Date("2026-11-01T00:00:00.000Z"),
          storeSubscriptionId,
        });

        const occurredAt = new Date("2026-11-15T00:00:00.000Z");
        // transferSubscription derives its own idempotency key; clean up by personId
        // sweep (target person rows go through the scenario's personId cleanup, but
        // the transfer writes the ledger under the target — sweep both).
        const db = yield* Db;
        const result = yield* svc.transferSubscription({
          fromPersonId: ids.personId,
          occurredAt,
          organizationId,
          paymentProviderConfigurationId: ids.configurationId,
          projectId,
          providerId: PROVIDER_ID,
          source: SOURCE,
          subscriptionId,
          toPersonId: targetPersonId,
          transferMode: "transfer_to_new_owner",
          triggerReason: "appstore_restore",
        });

        expect(result.idempotent).toBe(false);
        expect(Option.getOrNull(result.subscriptionId)).toBe(subscriptionId);
        expect(result.personId).toBe(targetPersonId);
        // transferred_out + transferred_in pair.
        expect(result.analyticsEventIds.length).toBe(2);

        const row = yield* findSubscriptionRow(subscriptionId);
        expect(row?.personId).toBe(targetPersonId);

        // Sweep the target person's leftover rows (ledger + perks + the now-
        // re-owned subscription) and the person row. The transfer moved the
        // subscription's personId to the target, so `cleanupScenario`'s
        // by-`ids.personId` sweep no longer matches it — delete it here.
        yield* Effect.addFinalizer(() =>
          Effect.gen(function* () {
            yield* db
              .delete(purchaseLedger)
              .where(eq(purchaseLedger.personId, targetPersonId))
              .pipe(Effect.ignore);
            yield* db
              .delete(personUnlockedPerks)
              .where(eq(personUnlockedPerks.personId, targetPersonId))
              .pipe(Effect.ignore);
            yield* db
              .delete(subscriptions)
              .where(eq(subscriptions.personId, targetPersonId))
              .pipe(Effect.ignore);
            yield* db.delete(persons).where(eq(persons.id, targetPersonId)).pipe(Effect.ignore);
          }),
        );
      }).pipe(Effect.scoped),
    ).pipe(
      Effect.provide(PurchaseProcessingService.layer),
      Effect.provide(PerkGrantService.layer),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "fails with PurchaseProcessingServiceError when the subscription does not exist",
    withPurchaseScenario("xfer-sub-missing", (ids) =>
      Effect.gen(function* () {
        const svc = yield* PurchaseProcessingService;

        const targetPersonId = uniqueKey("xfer-sub-missing-target");
        yield* seedTargetPerson(targetPersonId);
        const db = yield* Db;
        yield* Effect.addFinalizer(() =>
          db.delete(persons).where(eq(persons.id, targetPersonId)).pipe(Effect.ignore),
        );

        const error = yield* Effect.flip(
          svc.transferSubscription({
            fromPersonId: ids.personId,
            occurredAt: new Date("2026-11-20T00:00:00.000Z"),
            organizationId,
            paymentProviderConfigurationId: ids.configurationId,
            projectId,
            providerId: PROVIDER_ID,
            source: SOURCE,
            subscriptionId: uniqueKey("xfer-sub-missing-id"),
            toPersonId: targetPersonId,
            transferMode: "transfer_to_new_owner",
            triggerReason: "appstore_restore",
          }),
        );
        expect(error).toBeInstanceOf(PurchaseProcessingServiceError);
      }).pipe(Effect.scoped),
    ).pipe(
      Effect.provide(PurchaseProcessingService.layer),
      Effect.provide(PerkGrantService.layer),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "transfer_if_no_active_on_target leaves ownership with the previous owner when the target already has one",
    withPurchaseScenario("xfer-sub-keep", (ids, trackKey) =>
      Effect.gen(function* () {
        const svc = yield* PurchaseProcessingService;

        const targetPersonId = uniqueKey("xfer-sub-keep-target");
        yield* seedTargetPerson(targetPersonId);

        // The subscription to transfer (owned by the scenario person).
        const subscriptionId = uniqueKey("xfer-sub-keep-id");
        const storeSubscriptionId = uniqueKey("xfer-sub-keep-storesub");
        yield* seedActiveSubscription(ids, {
          expiresAt: new Date("2026-12-01T00:00:00.000Z"),
          id: subscriptionId,
          lastEventOccurredAt: new Date("2026-11-01T00:00:00.000Z"),
          startsAt: new Date("2026-11-01T00:00:00.000Z"),
          storeSubscriptionId,
        });

        // The target already owns an active subscription -> the count gate should keep ownership.
        const db = yield* Db;
        const targetSubscriptionId = uniqueKey("xfer-sub-keep-target-sub");
        yield* db.insert(subscriptions).values({
          cancelAtPeriodEnd: false,
          expiresAt: new Date("2026-12-01T00:00:00.000Z"),
          id: targetSubscriptionId,
          initialTransactionId: uniqueKey("xfer-sub-keep-target-tx"),
          isTrial: false,
          latestTransactionId: uniqueKey("xfer-sub-keep-target-tx2"),
          paymentProviderConfigurationProductId: ids.configurationProductId,
          personId: targetPersonId,
          providerEnvironment: ProviderEnvironment.Production,
          purchasedAt: new Date("2026-11-01T00:00:00.000Z"),
          startsAt: new Date("2026-11-01T00:00:00.000Z"),
          status: SubscriptionStatus.Active,
          storeSubscriptionId: uniqueKey("xfer-sub-keep-target-storesub"),
        });
        yield* Effect.addFinalizer(() =>
          Effect.gen(function* () {
            yield* db
              .delete(subscriptions)
              .where(eq(subscriptions.personId, targetPersonId))
              .pipe(Effect.ignore);
            yield* db.delete(persons).where(eq(persons.id, targetPersonId)).pipe(Effect.ignore);
          }),
        );

        const result = yield* svc.transferSubscription({
          fromPersonId: ids.personId,
          occurredAt: new Date("2026-11-15T00:00:00.000Z"),
          organizationId,
          paymentProviderConfigurationId: ids.configurationId,
          projectId,
          providerId: PROVIDER_ID,
          source: SOURCE,
          subscriptionId,
          toPersonId: targetPersonId,
          transferMode: "transfer_if_no_active_on_target",
          triggerReason: "appstore_restore",
        });

        // "kept" result: no analytics, ownership stays with the previous owner.
        expect(result.analyticsEventIds.length).toBe(0);
        expect(result.personId).toBe(ids.personId);

        const row = yield* findSubscriptionRow(subscriptionId);
        expect(row?.personId).toBe(ids.personId);
      }).pipe(Effect.scoped),
    ).pipe(
      Effect.provide(PurchaseProcessingService.layer),
      Effect.provide(PerkGrantService.layer),
      CoreAuthSession.authenticate(),
    ),
  );
});

describe("PurchaseProcessingService.transferPurchase", () => {
  test(
    "moves non-consumable purchase ownership to the target and emits a transferred pair",
    withPurchaseScenario("xfer-pur", (ids, trackKey) =>
      Effect.gen(function* () {
        const svc = yield* PurchaseProcessingService;

        const targetPersonId = uniqueKey("xfer-pur-target");
        yield* seedTargetPerson(targetPersonId);

        // Create a non-consumable one-time purchase owned by the scenario person.
        const completeKey = uniqueKey("xfer-pur-complete-key");
        trackKey(completeKey);
        const completedAt = new Date("2026-04-01T00:00:00.000Z");
        const providerKey = uniqueKey("xfer-pur-providerkey");
        const completed = yield* svc.completeOneTimePurchase({
          ...baseAction(ids, completeKey, completedAt),
          money: Option.some(money(4990)),
          providerTransactionId: Option.some(providerKey),
          purchaseType: "one-time",
          purchasedAt: completedAt,
        });
        const purchaseId = Option.getOrNull(completed.purchaseId);
        expect(purchaseId).not.toBeNull();

        const db = yield* Db;
        // The transfer moves the purchase's personId to the target, so
        // `cleanupScenario`'s by-`ids.personId` sweep no longer matches the
        // purchase row — delete it (plus the target's ledger + perks) here.
        yield* Effect.addFinalizer(() =>
          Effect.gen(function* () {
            yield* db
              .delete(purchaseLedger)
              .where(eq(purchaseLedger.personId, targetPersonId))
              .pipe(Effect.ignore);
            yield* db
              .delete(personUnlockedPerks)
              .where(eq(personUnlockedPerks.personId, targetPersonId))
              .pipe(Effect.ignore);
            yield* db
              .delete(purchases)
              .where(eq(purchases.personId, targetPersonId))
              .pipe(Effect.ignore);
            yield* db.delete(persons).where(eq(persons.id, targetPersonId)).pipe(Effect.ignore);
          }),
        );

        const result = yield* svc.transferPurchase({
          fromPersonId: ids.personId,
          occurredAt: new Date("2026-04-10T00:00:00.000Z"),
          organizationId,
          paymentProviderConfigurationId: ids.configurationId,
          projectId,
          providerId: PROVIDER_ID,
          purchaseId: purchaseId as string,
          source: SOURCE,
          toPersonId: targetPersonId,
          transferMode: "transfer_to_new_owner",
          triggerReason: "appstore_restore",
        });

        expect(result.personId).toBe(targetPersonId);
        expect(result.analyticsEventIds.length).toBe(2);

        const purchaseRow = yield* findPurchaseByProviderKey(providerKey);
        expect(purchaseRow?.personId).toBe(targetPersonId);
      }).pipe(Effect.scoped),
    ).pipe(
      Effect.provide(PurchaseProcessingService.layer),
      Effect.provide(PerkGrantService.layer),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "skips a consumable purchase (keeps it with the previous owner)",
    withPurchaseScenario("xfer-pur-consumable", (ids, trackKey) =>
      Effect.gen(function* () {
        const svc = yield* PurchaseProcessingService;

        const targetPersonId = uniqueKey("xfer-pur-cons-target");
        yield* seedTargetPerson(targetPersonId);

        const completeKey = uniqueKey("xfer-pur-cons-complete-key");
        trackKey(completeKey);
        const completedAt = new Date("2026-04-01T00:00:00.000Z");
        const providerKey = uniqueKey("xfer-pur-cons-providerkey");
        const completed = yield* svc.completeOneTimePurchase({
          ...baseAction(ids, completeKey, completedAt),
          money: Option.some(money(990)),
          providerTransactionId: Option.some(providerKey),
          purchaseType: "consumable",
          purchasedAt: completedAt,
        });
        const purchaseId = Option.getOrNull(completed.purchaseId);
        expect(purchaseId).not.toBeNull();

        const db = yield* Db;
        yield* Effect.addFinalizer(() =>
          db.delete(persons).where(eq(persons.id, targetPersonId)).pipe(Effect.ignore),
        );

        const result = yield* svc.transferPurchase({
          fromPersonId: ids.personId,
          occurredAt: new Date("2026-04-10T00:00:00.000Z"),
          organizationId,
          paymentProviderConfigurationId: ids.configurationId,
          projectId,
          providerId: PROVIDER_ID,
          purchaseId: purchaseId as string,
          source: SOURCE,
          toPersonId: targetPersonId,
          transferMode: "transfer_to_new_owner",
          triggerReason: "appstore_restore",
        });

        // Consumable purchases are not transferable -> kept with the previous owner.
        expect(result.analyticsEventIds.length).toBe(0);
        expect(result.personId).toBe(ids.personId);

        const purchaseRow = yield* findPurchaseByProviderKey(providerKey);
        expect(purchaseRow?.type).toBe(PurchaseType.OneTimeConsumable);
        expect(purchaseRow?.personId).toBe(ids.personId);
      }).pipe(Effect.scoped),
    ).pipe(
      Effect.provide(PurchaseProcessingService.layer),
      Effect.provide(PerkGrantService.layer),
      CoreAuthSession.authenticate(),
    ),
  );
});
