/**
 * Integration tests for the Stripe record engine ({@link StripePaymentProvider}
 * — `core/StripePaymentProvider`, exported from the barrel as
 * `StripePaymentProviderEngine`), run against the real backend stack
 * provisioned once by `test/_testing/globalSetup.ts` (live PlanetScale DB +
 * ClickHouse + WorkOS; only the project schema cache is an in-memory stub).
 *
 * The engine is a multi-branch purchase-recording machine: every `record*`
 * method decodes the verified Stripe `data.object`, resolves the Stripe
 * identity (creating / reusing a person and its `stripe`
 * `person_external_identifier`), looks up the product mapping by
 * `"${product}:${price}"`, derives a per-event idempotency key, builds the
 * money breakdown (gross/fee/tax from the REST charge-fee lookup), and routes
 * to the matching `PurchaseProcessingService` action — which persists the
 * operational `subscription` / `transaction` / `purchase` rows plus an
 * append-only `purchase_ledger` row. These tests drive that whole graph
 * end-to-end and verify the *persisted* side effects, not just the returned
 * `PurchaseProcessingResult`.
 *
 * Money / fee flow: a money-bearing `transaction` row (and its revenue
 * analytics) is only written when a `providerTransactionId` is present —
 * `resolveChargeKey = payment_intent ?? charge`. So start/renew/one-time events
 * carry a `payment_intent` (`pi_*`) and the fake `HttpClient` is wired with the
 * payment-intent → charge → balance-transaction fee routes for it. Every
 * money-bearing event uses `"usd"` so FX resolves to the identity rate offline.
 *
 * What the test wires that the harness does not provide: the engine layer pulls
 * in `PurchaseProcessingService`, `PersonIdentityService`, `FxRateService`,
 * `PaymentConfigSecretCrypto`, and a (fake) `HttpClient`. All of those bottom
 * out at the harness `Db` once given a handful of leaf stubs — see
 * `stripe-test-support.ts` (`stripeEngineLayer`). The typed `StripeContext`
 * (verifier + REST helpers) is built per test via
 * `engine.buildContextFromConfiguration(configurationRow)`; the typed
 * `StripeEvent` is produced by decoding a `makeStripeEvent` envelope through the
 * `StripeEventSchema`.
 *
 * Conventions (mirroring the App Store engine test): every test namespaces its
 * Stripe ids with a per-call unique suffix, asserts by membership / by-id
 * (never global counts), and self-cleans every row it creates via an
 * `Effect.ensuring(cleanupStripeScenario(...))` finalizer that collects every
 * Stripe customer id it touched. Typed failures are asserted with `Effect.flip`
 * + `instanceof`, paired with a DB-state assertion proving nothing leaked.
 * Follow-up lifecycle events on the same subscription bump `created` /
 * `occurredAt` by 60s so the second-precision `TIMESTAMP` watermark accepts the
 * projection update.
 */
import { DateTime, Effect, Option, Schema } from "effect";
import { constant } from "@voidhash/lib/lang";
import { expect } from "vitest";

import { Db, ProviderEnvironment } from "@voidhash/db";
import { ProductType } from "@voidhash/lib/constants";
import { StripePaymentProvider } from "@voidhash/core/services/paymentProviders/stripe/payment-provider";
// `stripe/events` + `stripe/errors` have no public package subpath, so they are
// imported by relative path into `src` (the unit-test convention in the brief).
import { StripeEventSchema } from "../../../../src/services/paymentProviders/stripe/events.ts";
import {
  StripePaymentProviderProductNotMappedError,
  StripePurchaseProcessingIdempotencyKeyDerivationError,
} from "../../../../src/services/paymentProviders/stripe/errors.ts";

import { CoreAuthSession } from "@testing/CoreAuthSession";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";
import { CoreTestFixture } from "@testing/CoreTestFixture";

import {
  chargeFeeRoutes,
  checkoutLineItemsRoute,
  cleanupStripeScenario,
  makeStripeCharge,
  makeStripeCheckoutSession,
  makeStripeEvent,
  makeStripeInvoice,
  makeStripeSubscription,
  noStripeRestHttpClient,
  paymentIntentChargeRoute,
  seedStripeConfig,
  seedStripeProduct,
  stripeEngineLayer,
  stripeStubHttpClient,
  uniq,
} from "./stripe-test-support.ts";

const { test } = CoreIntegrationTestHarness.make();

const projectId = CoreTestFixture.projectId;

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

const findProjectRow = () =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.projects.findFirst({ where: { id: projectId } }).pipe(Effect.orDie);
  });

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

const findSubscriptionsByStore = (configurationProductId: string, storeSubscriptionId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.subscriptions.findMany({
      where: {
        paymentProviderConfigurationProductId: configurationProductId,
        storeSubscriptionId,
      },
    });
  });

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

const findLedgerRowsByKey = (idempotencyKey: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.purchaseLedger.findMany({
      where: { idempotencyKey },
    });
  });

const findStripeExternalIdentifier = (identifier: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.personExternalIdentifiers.findFirst({
      where: {
        projectId,
        serviceId: "stripe",
        identifier,
      },
    });
  });

const findPerson = (id: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.persons.findFirst({ where: { id } });
  });

// ----------------------------------------------------------------------------
// Per-test setup + cleanup harness.
// ----------------------------------------------------------------------------

/**
 * Tracks the seeded config / product ids + the Stripe customer ids a test
 * touched so the `Effect.ensuring` finalizer can sweep every row regardless of
 * how the test exits. Ids are collected lazily (the body fills these), so a
 * mid-test failure still cleans.
 */
interface StripeTrack {
  configId: string | undefined;
  configProductId: string | undefined;
  productId: string | undefined;
  readonly customerIds: string[];
}

const newTrack = (): StripeTrack => ({
  configId: undefined,
  configProductId: undefined,
  customerIds: [],
  productId: undefined,
});

/**
 * Common per-test fixture: seeds an enabled Stripe configuration + a product
 * mapping under the fixture project, reads back the typed configuration row and
 * the live project row, and builds the per-tenant Stripe context. Records the
 * seeded ids in `track` for cleanup.
 */
const setupStripe = (
  track: StripeTrack,
  productOverrides?: {
    readonly type?: number;
    readonly stripeProductId?: string;
    readonly stripePriceId?: string;
  },
) =>
  Effect.gen(function* () {
    const engine = yield* StripePaymentProvider;
    const seededConfig = yield* seedStripeConfig();
    track.configId = seededConfig.configId;
    const product = yield* seedStripeProduct({
      configId: seededConfig.configId,
      ...productOverrides,
    });
    track.configProductId = product.configProductId;
    track.productId = product.productId;
    const configuration = yield* findConfiguration(seededConfig.configId);
    if (!configuration) {
      return yield* Effect.die(
        new Error(`stripe scenario: configuration ${seededConfig.configId} was not seeded`),
      );
    }
    const project = yield* findProjectRow();
    if (!project) {
      return yield* Effect.die(new Error(`stripe scenario: project ${projectId} is missing`));
    }
    const stripeContext = yield* engine.buildContextFromConfiguration(configuration);
    return { configuration, engine, product, project, stripeContext };
  });

/**
 * Wraps a test body so every row a Stripe scenario creates is removed afterward
 * regardless of exit. The body receives a mutable `track`; ids are read lazily
 * at finalization. Cleanup is a no-op when nothing was seeded.
 */
const withStripe = <E, R>(
  body: (track: StripeTrack) => Effect.Effect<void, E, R>,
): Effect.Effect<void, E, R | Db> => {
  const track = newTrack();
  return body(track).pipe(
    Effect.ensuring(
      Effect.suspend(() => {
        if (!track.configId) {
          return Effect.void;
        }
        return cleanupStripeScenario({
          configId: track.configId,
          configProductId: track.configProductId,
          customerIds: track.customerIds,
          productId: track.productId,
        });
      }),
    ),
  );
};

/** Decode a `makeStripeEvent` envelope into the typed `StripeEvent`. */
const decodeEvent = (input: {
  readonly type: string;
  readonly object: Record<string, unknown>;
  readonly previousAttributes?: Record<string, unknown>;
  readonly livemode?: boolean;
  readonly created?: number;
  readonly id?: string;
}) => Schema.decodeUnknownEffect(StripeEventSchema)(makeStripeEvent(input));

/**
 * Stub HTTP client routing `pi_x` → `ch_x` (fee 30 minor) for money-bearing
 * subscription/invoice events. A start/renew invoice carries `payment_intent`
 * `pi_x`; the engine fetches its latest charge then the charge's fee, so both
 * REST routes must be present for a `transaction` row + analytics to be written.
 */
const moneyHttpClient = () =>
  stripeStubHttpClient([
    paymentIntentChargeRoute({ chargeId: "ch_x", paymentIntentId: "pi_x" }),
    ...chargeFeeRoutes({ chargeId: "ch_x", feeMinor: 30 }),
  ]);

/**
 * Seeds a live subscription via `recordInvoicePaid` (subscription_create) so a
 * follow-up lifecycle event has a real `subscription` row to mutate. The
 * follow-up events reuse the returned `subId` / `customerId`. The seeding
 * invoice's `created` sits 60s EARLIER than every follow-up so the
 * subscription's `last_event_occurred_at` watermark (second-precision
 * `TIMESTAMP`) sits strictly before — a same-occurredAt projection update is
 * intermittently rejected by the `<= occurredAt` guard.
 */
const seedActiveSubscription = (
  ctx: Effect.Success<ReturnType<typeof setupStripe>>,
  track: StripeTrack,
  base: { readonly subId: string; readonly customerId: string; readonly created: number },
) =>
  Effect.gen(function* () {
    track.customerIds.push(base.customerId);
    const invoiceId = uniq("in");
    const event = yield* decodeEvent({
      created: base.created,
      object: makeStripeInvoice({
        amountPaid: 1990,
        billingReason: "subscription_create",
        created: base.created,
        customerId: base.customerId,
        distinctId: uniq("distinct"),
        id: invoiceId,
        paymentIntentId: "pi_x",
        stripePriceId: ctx.product.stripePriceId,
        stripeProductId: ctx.product.stripeProductId,
        subscriptionId: base.subId,
      }),
      type: "invoice.paid",
    });
    const result = yield* ctx.engine.recordInvoicePaid({
      configuration: ctx.configuration,
      event,
      mode: "test",
      project: ctx.project,
      providerEnvironment: ProviderEnvironment.Sandbox,
      receivedAt: yield* DateTime.nowAsDate,
      source: "webhook",
      stripeContext: ctx.stripeContext,
    });
    return { invoiceId, personId: result.personId };
  });

// ============================================================================
// Cases
// ============================================================================

// 1. invoice.paid subscription_create → startSubscription
test(
  "invoice.paid subscription_create routes to startSubscription and persists subscription + transaction + ledger + identity",
  withStripe((track) =>
    Effect.gen(function* () {
      const ctx = yield* setupStripe(track);
      const customerId = uniq("cus");
      const subId = uniq("sub");
      const invoiceId = uniq("in");
      track.customerIds.push(customerId);

      const event = yield* decodeEvent({
        object: makeStripeInvoice({
          amountPaid: 1990,
          billingReason: "subscription_create",
          customerId,
          distinctId: uniq("distinct"),
          id: invoiceId,
          paymentIntentId: "pi_x",
          stripePriceId: ctx.product.stripePriceId,
          stripeProductId: ctx.product.stripeProductId,
          subscriptionId: subId,
        }),
        type: "invoice.paid",
      });

      const result = yield* ctx.engine.recordInvoicePaid({
        configuration: ctx.configuration,
        event,
        mode: "test",
        project: ctx.project,
        providerEnvironment: ProviderEnvironment.Sandbox,
        receivedAt: yield* DateTime.nowAsDate,
        source: "webhook",
        stripeContext: ctx.stripeContext,
      });

      expect(result.idempotent).toBe(false);
      expect(result.analyticsEventIds.length).toBe(2);
      expect(result.personId.length).toBeGreaterThan(0);
      expect(Option.isSome(result.subscriptionId)).toBe(true);

      const subRow = yield* findSubscriptionByStore(ctx.product.configProductId, subId);
      expect(subRow).toBeDefined();
      expect(subRow?.personId).toBe(result.personId);
      expect(subRow?.providerEnvironment).toBe(ProviderEnvironment.Sandbox);

      const txRow = yield* findTransactionByStore(ctx.product.configProductId, "pi_x");
      expect(txRow).toBeDefined();
      expect(txRow?.personId).toBe(result.personId);

      const ledger = yield* findLedgerByKey(`stripe:${invoiceId}:purchase`);
      expect(ledger).toBeDefined();
      expect(ledger?.idempotencyKey).toBe(`stripe:${invoiceId}:purchase`);
      expect(ledger?.providerId).toBe("stripe");
      expect(ledger?.source).toBe("webhook");
      expect(ledger?.personId).toBe(result.personId);

      const ext = yield* findStripeExternalIdentifier(customerId);
      expect(ext).toBeDefined();
      expect(ext?.personId).toBe(result.personId);
      const person = yield* findPerson(result.personId);
      expect(person).toBeDefined();
    }),
  ).pipe(Effect.provide(stripeEngineLayer(moneyHttpClient())), CoreAuthSession.authenticate()),
);

// 2. duplicate invoice.paid → idempotent
test(
  "duplicate invoice.paid delivery returns an idempotent result with exactly one subscription + one ledger row",
  withStripe((track) =>
    Effect.gen(function* () {
      const ctx = yield* setupStripe(track);
      const customerId = uniq("cus");
      const subId = uniq("sub");
      const invoiceId = uniq("in");
      track.customerIds.push(customerId);

      const event = yield* decodeEvent({
        object: makeStripeInvoice({
          amountPaid: 1990,
          billingReason: "subscription_create",
          customerId,
          distinctId: uniq("distinct"),
          id: invoiceId,
          paymentIntentId: "pi_x",
          stripePriceId: ctx.product.stripePriceId,
          stripeProductId: ctx.product.stripeProductId,
          subscriptionId: subId,
        }),
        type: "invoice.paid",
      });

      const input = {
        configuration: ctx.configuration,
        event,
        mode: constant("test"),
        project: ctx.project,
        providerEnvironment: ProviderEnvironment.Sandbox,
        receivedAt: yield* DateTime.nowAsDate,
        source: constant("webhook"),
        stripeContext: ctx.stripeContext,
      };

      const first = yield* ctx.engine.recordInvoicePaid(input);
      expect(first.idempotent).toBe(false);

      const second = yield* ctx.engine.recordInvoicePaid(input);
      expect(second.idempotent).toBe(true);
      expect(Option.getOrNull(second.subscriptionId)).toBe(Option.getOrNull(first.subscriptionId));
      expect(Option.getOrNull(second.transactionId)).toBe(Option.getOrNull(first.transactionId));
      expect(second.analyticsEventIds).toEqual(first.analyticsEventIds);

      const subRows = yield* findSubscriptionsByStore(ctx.product.configProductId, subId);
      expect(subRows.length).toBe(1);
      const ledgerRows = yield* findLedgerRowsByKey(`stripe:${invoiceId}:purchase`);
      expect(ledgerRows.length).toBe(1);
    }),
  ).pipe(Effect.provide(stripeEngineLayer(moneyHttpClient())), CoreAuthSession.authenticate()),
);

// 3. invoice.paid subscription_cycle → renewSubscription
test(
  "invoice.paid subscription_cycle routes to renewSubscription and tags the ledger as renewal",
  withStripe((track) =>
    Effect.gen(function* () {
      const ctx = yield* setupStripe(track);
      const customerId = uniq("cus");
      const subId = uniq("sub");
      const created = 1_700_000_000;
      yield* seedActiveSubscription(ctx, track, { created, customerId, subId });

      const renewalInvoiceId = uniq("in");
      const renewalEvent = yield* decodeEvent({
        created: created + 60,
        object: makeStripeInvoice({
          amountPaid: 1990,
          billingReason: "subscription_cycle",
          created: created + 60,
          customerId,
          distinctId: uniq("distinct"),
          id: renewalInvoiceId,
          paymentIntentId: "pi_x",
          stripePriceId: ctx.product.stripePriceId,
          stripeProductId: ctx.product.stripeProductId,
          subscriptionId: subId,
        }),
        type: "invoice.paid",
      });

      const result = yield* ctx.engine.recordInvoicePaid({
        configuration: ctx.configuration,
        event: renewalEvent,
        mode: "test",
        project: ctx.project,
        providerEnvironment: ProviderEnvironment.Sandbox,
        receivedAt: yield* DateTime.nowAsDate,
        source: "webhook",
        stripeContext: ctx.stripeContext,
      });

      expect(result.analyticsEventIds.length).toBe(1);
      const ledger = yield* findLedgerByKey(`stripe:${renewalInvoiceId}:renewal`);
      expect(ledger).toBeDefined();
      expect(ledger?.idempotencyKey).toBe(`stripe:${renewalInvoiceId}:renewal`);
    }),
  ).pipe(Effect.provide(stripeEngineLayer(moneyHttpClient())), CoreAuthSession.authenticate()),
);

// 4. invoice.payment_failed → enterBillingRetry
test(
  "invoice.payment_failed routes to enterBillingRetry (one analytics event when the subscription exists)",
  withStripe((track) =>
    Effect.gen(function* () {
      const ctx = yield* setupStripe(track);
      const customerId = uniq("cus");
      const subId = uniq("sub");
      const created = 1_700_000_000;
      yield* seedActiveSubscription(ctx, track, { created, customerId, subId });

      const failedInvoiceId = uniq("in");
      const failedEvent = yield* decodeEvent({
        created: created + 60,
        object: {
          ...makeStripeInvoice({
            amountPaid: 0,
            billingReason: "subscription_cycle",
            created: created + 60,
            customerId,
            distinctId: uniq("distinct"),
            id: failedInvoiceId,
            stripePriceId: ctx.product.stripePriceId,
            stripeProductId: ctx.product.stripeProductId,
            subscriptionId: subId,
          }),
          attempt_count: 1,
        },
        type: "invoice.payment_failed",
      });

      const result = yield* ctx.engine.recordInvoicePaymentFailed({
        configuration: ctx.configuration,
        event: failedEvent,
        mode: "test",
        project: ctx.project,
        providerEnvironment: ProviderEnvironment.Sandbox,
        receivedAt: yield* DateTime.nowAsDate,
        source: "webhook",
        stripeContext: ctx.stripeContext,
      });

      expect(result.analyticsEventIds.length).toBe(1);
      const ledger = yield* findLedgerByKey(`stripe:${failedInvoiceId}:billing_retry:1`);
      expect(ledger).toBeDefined();
    }),
  ).pipe(
    Effect.provide(stripeEngineLayer(noStripeRestHttpClient())),
    CoreAuthSession.authenticate(),
  ),
);

// 5. customer.subscription.updated cancel_at_period_end false→true → cancelSubscription
test(
  "customer.subscription.updated (cancel_at_period_end false→true) routes to cancelSubscription",
  withStripe((track) =>
    Effect.gen(function* () {
      const ctx = yield* setupStripe(track);
      const customerId = uniq("cus");
      const subId = uniq("sub");
      const created = 1_700_000_000;
      yield* seedActiveSubscription(ctx, track, { created, customerId, subId });

      // No distinctId on the lifecycle event: identity resolves via the
      // `stripe` customer binding the seeding invoice created, reusing the same
      // person rather than churning a new one.
      const event = yield* decodeEvent({
        created: created + 60,
        object: makeStripeSubscription({
          cancelAtPeriodEnd: true,
          customerId,
          id: subId,
          stripePriceId: ctx.product.stripePriceId,
          stripeProductId: ctx.product.stripeProductId,
        }),
        previousAttributes: { cancel_at_period_end: false },
        type: "customer.subscription.updated",
      });

      const result = yield* ctx.engine.recordSubscriptionUpdated({
        configuration: ctx.configuration,
        event,
        mode: "test",
        project: ctx.project,
        providerEnvironment: ProviderEnvironment.Sandbox,
        receivedAt: yield* DateTime.nowAsDate,
        source: "webhook",
        stripeContext: ctx.stripeContext,
      });

      expect(result.analyticsEventIds.length).toBe(1);
      const subRow = yield* findSubscriptionByStore(ctx.product.configProductId, subId);
      expect(subRow?.cancelAtPeriodEnd).toBe(true);
    }),
  ).pipe(
    Effect.provide(stripeEngineLayer(noStripeRestHttpClient())),
    CoreAuthSession.authenticate(),
  ),
);

// 6. customer.subscription.updated cancel_at_period_end true→false → resumeAutoRenew
test(
  "customer.subscription.updated (cancel_at_period_end true→false) routes to resumeAutoRenew",
  withStripe((track) =>
    Effect.gen(function* () {
      const ctx = yield* setupStripe(track);
      const customerId = uniq("cus");
      const subId = uniq("sub");
      const created = 1_700_000_000;
      yield* seedActiveSubscription(ctx, track, { created, customerId, subId });

      // First record the cancel intent so resume has something to clear.
      const cancelEvent = yield* decodeEvent({
        created: created + 60,
        object: makeStripeSubscription({
          cancelAtPeriodEnd: true,
          customerId,
          id: subId,
          stripePriceId: ctx.product.stripePriceId,
          stripeProductId: ctx.product.stripeProductId,
        }),
        previousAttributes: { cancel_at_period_end: false },
        type: "customer.subscription.updated",
      });
      yield* ctx.engine.recordSubscriptionUpdated({
        configuration: ctx.configuration,
        event: cancelEvent,
        mode: "test",
        project: ctx.project,
        providerEnvironment: ProviderEnvironment.Sandbox,
        receivedAt: yield* DateTime.nowAsDate,
        source: "webhook",
        stripeContext: ctx.stripeContext,
      });

      const resumeEvent = yield* decodeEvent({
        created: created + 120,
        object: makeStripeSubscription({
          cancelAtPeriodEnd: false,
          customerId,
          id: subId,
          stripePriceId: ctx.product.stripePriceId,
          stripeProductId: ctx.product.stripeProductId,
        }),
        previousAttributes: { cancel_at_period_end: true },
        type: "customer.subscription.updated",
      });

      const result = yield* ctx.engine.recordSubscriptionUpdated({
        configuration: ctx.configuration,
        event: resumeEvent,
        mode: "test",
        project: ctx.project,
        providerEnvironment: ProviderEnvironment.Sandbox,
        receivedAt: yield* DateTime.nowAsDate,
        source: "webhook",
        stripeContext: ctx.stripeContext,
      });

      expect(result.analyticsEventIds.length).toBe(1);
      const subRow = yield* findSubscriptionByStore(ctx.product.configProductId, subId);
      expect(subRow?.cancelAtPeriodEnd).toBe(false);
    }),
  ).pipe(
    Effect.provide(stripeEngineLayer(noStripeRestHttpClient())),
    CoreAuthSession.authenticate(),
  ),
);

// 7. customer.subscription.updated with no relevant change → IGNORED
test(
  "customer.subscription.updated with no relevant previous_attributes change is ignored",
  withStripe((track) =>
    Effect.gen(function* () {
      const ctx = yield* setupStripe(track);
      const customerId = uniq("cus");
      const subId = uniq("sub");
      // Not seeding an active subscription: an ignored event writes nothing.

      const event = yield* decodeEvent({
        object: makeStripeSubscription({
          customerId,
          id: subId,
          stripePriceId: ctx.product.stripePriceId,
          stripeProductId: ctx.product.stripeProductId,
        }),
        // A non-cancel / non-items change (e.g. only the status flipped).
        previousAttributes: { status: "past_due" },
        type: "customer.subscription.updated",
      });

      const result = yield* ctx.engine.recordSubscriptionUpdated({
        configuration: ctx.configuration,
        event,
        mode: "test",
        project: ctx.project,
        providerEnvironment: ProviderEnvironment.Sandbox,
        receivedAt: yield* DateTime.nowAsDate,
        source: "webhook",
        stripeContext: ctx.stripeContext,
      });

      expect(result.idempotent).toBe(true);
      expect(result.personId).toBe("");
      expect(result.analyticsEventIds.length).toBe(0);
      expect(Option.isNone(result.subscriptionId)).toBe(true);

      const subRow = yield* findSubscriptionByStore(ctx.product.configProductId, subId);
      expect(subRow).toBeUndefined();
    }),
  ).pipe(
    Effect.provide(stripeEngineLayer(noStripeRestHttpClient())),
    CoreAuthSession.authenticate(),
  ),
);

// 8. customer.subscription.deleted → expireSubscription
test(
  "customer.subscription.deleted routes to expireSubscription",
  withStripe((track) =>
    Effect.gen(function* () {
      const ctx = yield* setupStripe(track);
      const customerId = uniq("cus");
      const subId = uniq("sub");
      const created = 1_700_000_000;
      yield* seedActiveSubscription(ctx, track, { created, customerId, subId });

      const endedAt = created + 60;
      const event = yield* decodeEvent({
        created: endedAt,
        object: makeStripeSubscription({
          customerId,
          endedAt,
          id: subId,
          status: "canceled",
          stripePriceId: ctx.product.stripePriceId,
          stripeProductId: ctx.product.stripeProductId,
        }),
        type: "customer.subscription.deleted",
      });

      const result = yield* ctx.engine.recordSubscriptionDeleted({
        configuration: ctx.configuration,
        event,
        mode: "test",
        project: ctx.project,
        providerEnvironment: ProviderEnvironment.Sandbox,
        receivedAt: yield* DateTime.nowAsDate,
        source: "webhook",
        stripeContext: ctx.stripeContext,
      });

      expect(result.analyticsEventIds.length).toBe(1);
      expect(Option.isSome(result.subscriptionId)).toBe(true);
      const ledger = yield* findLedgerByKey(`stripe:${subId}:expired:${endedAt}`);
      expect(ledger).toBeDefined();
    }),
  ).pipe(
    Effect.provide(stripeEngineLayer(noStripeRestHttpClient())),
    CoreAuthSession.authenticate(),
  ),
);

// 9. checkout.session.completed (mode payment) → completeOneTimePurchase
//
// The engine captures its `HttpClient` at construction (the per-tenant
// `StripeContext` is built over it), so the checkout line-items REST route must
// live in the LAYER's fake client. `fetchCheckoutLineItemPriceProduct` is NOT
// best-effort — an unmatched (`{}`) response would surface as a transient
// failure — so the route must resolve to this test's seeded product. The
// session id, product id, and price id are therefore PINNED so they are known
// at the outer layer pipe; cleanup keys on customer ids, so fixed ids are safe.
const ONE_TIME_SESSION_ID = "cs_it_one_time";
const ONE_TIME_PRODUCT_ID = "prod_it_one_time";
const ONE_TIME_PRICE_ID = "price_it_one_time";
test(
  "checkout.session.completed (mode payment) routes to completeOneTimePurchase and persists a purchase + transaction",
  withStripe((track) =>
    Effect.gen(function* () {
      const ctx = yield* setupStripe(track, {
        stripePriceId: ONE_TIME_PRICE_ID,
        stripeProductId: ONE_TIME_PRODUCT_ID,
        type: ProductType.OneTime,
      });
      const customerId = uniq("cus");
      track.customerIds.push(customerId);

      const event = yield* decodeEvent({
        object: makeStripeCheckoutSession({
          amountTotal: 4990,
          clientReferenceId: uniq("distinct"),
          customerId,
          id: ONE_TIME_SESSION_ID,
          mode: "payment",
          paymentIntentId: "pi_x",
          paymentStatus: "paid",
        }),
        type: "checkout.session.completed",
      });

      const result = yield* ctx.engine.recordCheckoutSessionCompleted({
        configuration: ctx.configuration,
        event,
        mode: "test",
        project: ctx.project,
        providerEnvironment: ProviderEnvironment.Sandbox,
        receivedAt: yield* DateTime.nowAsDate,
        source: "webhook",
        stripeContext: ctx.stripeContext,
      });

      expect(result.analyticsEventIds.length).toBe(1);
      expect(result.personId.length).toBeGreaterThan(0);

      const purchaseRow = yield* findPurchaseByProviderKey("pi_x");
      expect(purchaseRow).toBeDefined();
      expect(purchaseRow?.personId).toBe(result.personId);
      expect(purchaseRow?.paymentProviderConfigurationProductId).toBe(ctx.product.configProductId);

      const txRow = yield* findTransactionByStore(ctx.product.configProductId, "pi_x");
      expect(txRow).toBeDefined();
    }),
  ).pipe(
    Effect.provide(
      stripeEngineLayer(
        stripeStubHttpClient([
          paymentIntentChargeRoute({ chargeId: "ch_x", paymentIntentId: "pi_x" }),
          ...chargeFeeRoutes({ chargeId: "ch_x", feeMinor: 30 }),
          checkoutLineItemsRoute({
            priceId: ONE_TIME_PRICE_ID,
            productId: ONE_TIME_PRODUCT_ID,
            sessionId: ONE_TIME_SESSION_ID,
          }),
        ]),
      ),
    ),
    CoreAuthSession.authenticate(),
  ),
);

// 10. charge.refunded after a one-time purchase → refundPurchase
//
// The original one-time purchase is built via a checkout with payment_intent
// `pi_ref`; its transaction is keyed `storeTransactionId = pi_ref`. The refund
// charge carries the same `pi_ref` (`resolveChargeKey = payment_intent`), so
// `refundPurchase` reconstructs money from — and marks — that transaction. As
// in case 9 the checkout's session / product / price ids are PINNED so the
// line-items route in the layer client resolves to the seeded mapping.
const REFUND_SESSION_ID = "cs_it_refund";
const REFUND_PRODUCT_ID = "prod_it_refund";
const REFUND_PRICE_ID = "price_it_refund";
test(
  "charge.refunded (refunded:true) after a one-time purchase routes to refundPurchase and sets refundedAt",
  withStripe((track) =>
    Effect.gen(function* () {
      const ctx = yield* setupStripe(track, {
        stripePriceId: REFUND_PRICE_ID,
        stripeProductId: REFUND_PRODUCT_ID,
        type: ProductType.OneTime,
      });
      const customerId = uniq("cus");
      const chargeId = uniq("ch");
      track.customerIds.push(customerId);

      // Build the original one-time purchase via checkout with payment_intent "pi_ref".
      const checkoutEvent = yield* decodeEvent({
        object: makeStripeCheckoutSession({
          amountTotal: 4990,
          clientReferenceId: uniq("distinct"),
          customerId,
          id: REFUND_SESSION_ID,
          mode: "payment",
          paymentIntentId: "pi_ref",
          paymentStatus: "paid",
        }),
        type: "checkout.session.completed",
      });
      yield* ctx.engine.recordCheckoutSessionCompleted({
        configuration: ctx.configuration,
        event: checkoutEvent,
        mode: "test",
        project: ctx.project,
        providerEnvironment: ProviderEnvironment.Sandbox,
        receivedAt: yield* DateTime.nowAsDate,
        source: "webhook",
        stripeContext: ctx.stripeContext,
      });

      const refundEvent = yield* decodeEvent({
        created: 1_700_000_060,
        object: makeStripeCharge({
          amount: 4990,
          created: 1_700_000_060,
          customerId,
          id: chargeId,
          paymentIntentId: "pi_ref",
          refunded: true,
        }),
        type: "charge.refunded",
      });

      const result = yield* ctx.engine.recordChargeRefunded({
        configuration: ctx.configuration,
        event: refundEvent,
        mode: "test",
        project: ctx.project,
        providerEnvironment: ProviderEnvironment.Sandbox,
        receivedAt: yield* DateTime.nowAsDate,
        source: "webhook",
        stripeContext: ctx.stripeContext,
      });

      expect(result.analyticsEventIds.length).toBe(1);
      const txRow = yield* findTransactionByStore(ctx.product.configProductId, "pi_ref");
      expect(txRow).toBeDefined();
      expect(txRow?.refundedAt).toBeInstanceOf(Date);

      const ledger = yield* findLedgerByKey(`stripe:pi_ref:refund`);
      expect(ledger).toBeDefined();
    }),
  ).pipe(
    Effect.provide(
      stripeEngineLayer(
        // checkout one-time uses pi_ref → ch_ref for fee + line items; the
        // refund charge already carries pi_ref, so it needs no REST.
        stripeStubHttpClient([
          paymentIntentChargeRoute({ chargeId: "ch_ref", paymentIntentId: "pi_ref" }),
          ...chargeFeeRoutes({ chargeId: "ch_ref", feeMinor: 30 }),
          checkoutLineItemsRoute({
            priceId: REFUND_PRICE_ID,
            productId: REFUND_PRODUCT_ID,
            sessionId: REFUND_SESSION_ID,
          }),
        ]),
      ),
    ),
    CoreAuthSession.authenticate(),
  ),
);

// 11. unmapped product → StripePaymentProviderProductNotMappedError
test(
  "invoice.paid referencing an unmapped price/product fails with ProductNotMappedError and writes nothing",
  withStripe((track) =>
    Effect.gen(function* () {
      const ctx = yield* setupStripe(track);
      const customerId = uniq("cus");
      const subId = uniq("sub");
      const invoiceId = uniq("in");
      const unmappedProductId = uniq("prod");
      const unmappedPriceId = uniq("price");
      const unmappedKey = `${unmappedProductId}:${unmappedPriceId}`;

      const event = yield* decodeEvent({
        object: makeStripeInvoice({
          amountPaid: 1990,
          billingReason: "subscription_create",
          customerId,
          id: invoiceId,
          paymentIntentId: "pi_x",
          // References a price/product with no active mapping.
          stripePriceId: unmappedPriceId,
          stripeProductId: unmappedProductId,
          subscriptionId: subId,
        }),
        type: "invoice.paid",
      });

      const error = yield* Effect.flip(
        ctx.engine.recordInvoicePaid({
          configuration: ctx.configuration,
          event,
          mode: "test",
          project: ctx.project,
          providerEnvironment: ProviderEnvironment.Sandbox,
          receivedAt: yield* DateTime.nowAsDate,
          source: "webhook",
          stripeContext: ctx.stripeContext,
        }),
      );

      expect(error).toBeInstanceOf(StripePaymentProviderProductNotMappedError);
      if (error instanceof StripePaymentProviderProductNotMappedError) {
        expect(error.providerProductKey).toBe(unmappedKey);
        expect(error.paymentProviderConfigurationId).toBe(ctx.configuration.id);
      }

      const subRow = yield* findSubscriptionByStore(ctx.product.configProductId, subId);
      expect(subRow).toBeUndefined();
      const ledger = yield* findLedgerByKey(`stripe:${invoiceId}:purchase`);
      expect(ledger).toBeUndefined();
    }),
  ).pipe(Effect.provide(stripeEngineLayer(moneyHttpClient())), CoreAuthSession.authenticate()),
);

// 12. idempotency-key derivation failure (missing invoice.id)
test(
  "invoice.paid with an empty invoice id fails with IdempotencyKeyDerivationError and writes nothing",
  withStripe((track) =>
    Effect.gen(function* () {
      const ctx = yield* setupStripe(track);
      const customerId = uniq("cus");
      const subId = uniq("sub");

      const event = yield* decodeEvent({
        object: makeStripeInvoice({
          amountPaid: 1990,
          billingReason: "subscription_create",
          customerId,
          // Empty invoice id: the purchase idempotency anchor (invoice.id) is absent.
          id: "",
          paymentIntentId: "pi_x",
          stripePriceId: ctx.product.stripePriceId,
          stripeProductId: ctx.product.stripeProductId,
          subscriptionId: subId,
        }),
        type: "invoice.paid",
      });
      track.customerIds.push(customerId); // identity is resolved before key derivation

      const error = yield* Effect.flip(
        ctx.engine.recordInvoicePaid({
          configuration: ctx.configuration,
          event,
          mode: "test",
          project: ctx.project,
          providerEnvironment: ProviderEnvironment.Sandbox,
          receivedAt: yield* DateTime.nowAsDate,
          source: "webhook",
          stripeContext: ctx.stripeContext,
        }),
      );

      expect(error).toBeInstanceOf(StripePurchaseProcessingIdempotencyKeyDerivationError);
      if (error instanceof StripePurchaseProcessingIdempotencyKeyDerivationError) {
        expect(error.missingField).toBe("invoice.id");
        expect(error.eventType).toBe("purchase");
      }

      const subRow = yield* findSubscriptionByStore(ctx.product.configProductId, subId);
      expect(subRow).toBeUndefined();
    }),
  ).pipe(Effect.provide(stripeEngineLayer(moneyHttpClient())), CoreAuthSession.authenticate()),
);
