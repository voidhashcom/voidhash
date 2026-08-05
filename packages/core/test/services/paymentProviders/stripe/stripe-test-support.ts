/**
 * Shared fixtures for the Stripe payment-provider integration + unit tests.
 *
 * Provides:
 *  - `signStripePayload` — the in-process HMAC signer that produces a valid
 *    `Stripe-Signature` header for a raw body (mirrors the verifier in
 *    `stripe/sdk-context.ts`), so the webhook handler is exercised end-to-end
 *    without a real Stripe signature (no Apple-CA-style wall).
 *  - `stripeStubHttpClient` — a fake `HttpClient` routing canned JSON by request
 *    path, so the engine's REST enrichment (charge fee, checkout line items,
 *    payment-intent latest charge) is driven deterministically offline.
 *  - the engine + webhook-handler dependency layers, parameterized on that
 *    fake `HttpClient`.
 *  - `seedStripeConfig` / `seedStripeProduct` and a `cleanupStripeScenario`
 *    sweep keyed on the seeded config/product + the customer/person ids a test
 *    records (the engine creates persons lazily).
 *  - Stripe event-object builders.
 */
import { Effect, Layer } from "effect";
import { HttpClient, HttpClientResponse } from "effect/unstable/http";

import {
  FxRateService,
  IdentityProjectionPublisher,
  PerkGrantService,
  PersonIdentityService,
  PurchaseProcessingService,
} from "@voidhash/core/services";
import { StripePaymentProvider } from "@voidhash/core/services/paymentProviders/stripe/payment-provider";
import { StripePaymentProviderServiceLive } from "@voidhash/core/services/paymentProviders/stripe/payment-provider-service";
import { StripeWebhookHandlerService } from "@voidhash/core/services/paymentProviders/stripe/stripe-webhook-handler-service";
import { PaymentConfigSecretCrypto } from "@voidhash/core/utils/crypto/PaymentConfigSecretCrypto";
import { generateId } from "@voidhash/core/utils";
import { ProductType } from "@voidhash/lib/constants";
import {
  Db,
  eq,
  inArray,
  paymentProviderConfigurationProducts,
  paymentProviderConfigurations,
  paymentProviderNotificationProcessed,
  personExternalIdentifiers,
  personIdentities,
  persons,
  products,
  purchaseLedger,
  purchases,
  subscriptions,
  transactions,
} from "@voidhash/db";

import { CoreTestFixture } from "@testing/CoreTestFixture";

/** Default test signing secrets (no-op crypto → stored plaintext, signed verbatim). */
export const TEST_LIVE_WEBHOOK_SECRET = "whsec_live_testsecret";
export const TEST_TEST_WEBHOOK_SECRET = "whsec_test_testsecret";
export const TEST_LIVE_SECRET_KEY = "sk_live_testkey";
export const TEST_TEST_SECRET_KEY = "sk_test_testkey";

/** Monotonic counter so generated ids stay unique even within one millisecond. */
let seq = 0;
export const uniq = (label: string) => `it-stripe-${label}-${Date.now()}-${seq++}`;

/**
 * Produces a valid `Stripe-Signature` header (`t=…,v1=…`) for `rawBody` using
 * the same HMAC-SHA256-over-`${t}.${rawBody}` scheme the handler verifies.
 */
export const signStripePayload = async (
  rawBody: string,
  secret: string,
  timestampSeconds: number,
): Promise<string> => {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${timestampSeconds}.${rawBody}`),
  );
  const hex = Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `t=${timestampSeconds},v1=${hex}`;
};

/** A canned JSON response selected by a substring of the request path. */
export interface StripeStubRoute {
  readonly path: string;
  readonly body: unknown;
  readonly status?: number;
}

/**
 * Fake `HttpClient` returning canned JSON keyed on request path substring. Any
 * unmatched request returns `{}` with 200 — the engine's REST helpers treat a
 * shapeless response as "fee/line-item unavailable" without failing.
 */
export const stripeStubHttpClient = (
  routes: ReadonlyArray<StripeStubRoute>,
): HttpClient.HttpClient =>
  HttpClient.make((request, url) =>
    Effect.sync(() => {
      const match = routes.find((route) => url.pathname.includes(route.path));
      const webResponse = new Response(JSON.stringify(match?.body ?? {}), {
        headers: { "Content-Type": "application/json" },
        status: match?.status ?? 200,
      });
      return HttpClientResponse.fromWeb(request, webResponse);
    }),
  );

/** No fee/line-item REST calls expected (the test crafts events that skip them). */
export const noStripeRestHttpClient = (): HttpClient.HttpClient => stripeStubHttpClient([]);

/** Canned routes for a paid charge whose balance transaction carries `feeMinor`. */
export const chargeFeeRoutes = (input: {
  readonly chargeId: string;
  readonly balanceTransactionId?: string;
  readonly feeMinor: number;
  readonly currency?: string;
}): ReadonlyArray<StripeStubRoute> => {
  const btId = input.balanceTransactionId ?? `txn_${input.chargeId}`;
  return [
    {
      body: { balance_transaction: btId, id: input.chargeId, object: "charge" },
      path: `/v1/charges/${input.chargeId}`,
    },
    {
      body: {
        currency: input.currency ?? "usd",
        fee: input.feeMinor,
        id: btId,
        net: 0,
        object: "balance_transaction",
      },
      path: `/v1/balance_transactions/${btId}`,
    },
  ];
};

/** Canned route for a payment intent's latest charge (fee lookup for one-time / checkout). */
export const paymentIntentChargeRoute = (input: {
  readonly paymentIntentId: string;
  readonly chargeId: string;
}): StripeStubRoute => ({
  body: { id: input.paymentIntentId, latest_charge: input.chargeId, object: "payment_intent" },
  path: `/v1/payment_intents/${input.paymentIntentId}`,
});

/** Canned route for a checkout session's line items (price/product resolution). */
export const checkoutLineItemsRoute = (input: {
  readonly sessionId: string;
  readonly priceId: string;
  readonly productId: string;
}): StripeStubRoute => ({
  body: {
    data: [
      {
        adjustable_quantity: null,
        amount_discount: 0,
        amount_subtotal: 0,
        amount_tax: 0,
        amount_total: 0,
        currency: "usd",
        description: null,
        id: `li_${input.sessionId}`,
        metadata: null,
        object: "item",
        price: { id: input.priceId, object: "price", product: input.productId },
        quantity: 1,
      },
    ],
    has_more: false,
    object: "list",
    url: `/v1/checkout/sessions/${input.sessionId}/line_items`,
  },
  path: `/v1/checkout/sessions/${input.sessionId}/line_items`,
});

const stripeLeafDeps = (httpClient: HttpClient.HttpClient) =>
  Layer.mergeAll(
    PurchaseProcessingService.layer,
    PersonIdentityService.layer,
    FxRateService.layer({ apiKey: Effect.succeed("test-fx-key") }),
    PaymentConfigSecretCrypto.layer({ key: Effect.succeed("") }),
    Layer.succeed(HttpClient.HttpClient, httpClient),
  );

const stripeLeafStubs = Layer.mergeAll(PerkGrantService.layer, IdentityProjectionPublisher.noop);

/**
 * Full dependency graph for the Stripe record engine, over a fake `HttpClient`.
 * Everything bottoms out at the harness `Db` + per-test `AuthSession` (via
 * `PerkGrantService`). USE A `usd` CURRENCY in money-bearing events so FX
 * resolves to the identity rate without a network call.
 */
export const stripeEngineLayer = (httpClient: HttpClient.HttpClient) =>
  StripePaymentProvider.layer.pipe(
    Layer.provideMerge(stripeLeafDeps(httpClient)),
    Layer.provideMerge(stripeLeafStubs),
  );

/** Full dependency graph for the Stripe webhook handler, over a fake `HttpClient`. */
export const stripeWebhookHandlerLayer = (httpClient: HttpClient.HttpClient) =>
  StripeWebhookHandlerService.layer.pipe(
    Layer.provideMerge(stripeLeafDeps(httpClient)),
    Layer.provideMerge(stripeLeafStubs),
  );

/**
 * Full dependency graph for the public `StripePaymentProviderService` boundary,
 * over a fake `HttpClient`. `StripePaymentProviderServiceLive` delegates to the
 * webhook handler, so it bottoms out at exactly the same leaf deps + stubs as
 * `stripeWebhookHandlerLayer`; the only requirements that escape are the harness
 * `Db` and the per-test `AuthSession` (via `PerkGrantService`).
 */
export const stripeServiceLayer = (httpClient: HttpClient.HttpClient) =>
  StripePaymentProviderServiceLive.pipe(
    Layer.provideMerge(stripeLeafDeps(httpClient)),
    Layer.provideMerge(stripeLeafStubs),
  );

export interface SeededStripeConfig {
  readonly configId: string;
  readonly accountId: string;
}

/**
 * Inserts an enabled Stripe `payment_provider_configuration` under the fixture
 * project with plaintext live/test secrets (no-op crypto). Returns its id.
 */
export const seedStripeConfig = (input?: {
  readonly liveWebhookSecret?: string;
  readonly testWebhookSecret?: string;
}) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const configId = generateId("paymentProviderConfiguration");
    const accountId = `acct_${configId.replace(/[^A-Za-z0-9]/g, "")}`;
    yield* db.insert(paymentProviderConfigurations).values({
      configuration: {
        accountId,
        live: {
          secretKey: TEST_LIVE_SECRET_KEY,
          webhookSecret: input?.liveWebhookSecret ?? TEST_LIVE_WEBHOOK_SECRET,
        },
        test: {
          secretKey: TEST_TEST_SECRET_KEY,
          webhookSecret: input?.testWebhookSecret ?? TEST_TEST_WEBHOOK_SECRET,
        },
      },
      enabled: true,
      id: configId,
      name: "Stripe",
      paymentProviderKey: accountId,
      projectId: CoreTestFixture.projectId,
      providerId: "stripe",
    });
    return { accountId, configId } satisfies SeededStripeConfig;
  });

export interface SeededStripeProduct {
  readonly productId: string;
  readonly configProductId: string;
  readonly providerProductKey: string;
  readonly stripeProductId: string;
  readonly stripePriceId: string;
}

/**
 * Inserts an internal product + an active Stripe product mapping under the
 * given configuration. `providerProductKey` is `"${stripeProductId}:${stripePriceId}"`.
 */
export const seedStripeProduct = (input: {
  readonly configId: string;
  readonly type?: number;
  readonly stripeProductId?: string;
  readonly stripePriceId?: string;
}) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const productId = generateId("product");
    const configProductId = generateId("paymentProviderProduct");
    const stripeProductId =
      input.stripeProductId ?? `prod_${productId.replace(/[^A-Za-z0-9]/g, "")}`;
    const stripePriceId =
      input.stripePriceId ?? `price_${configProductId.replace(/[^A-Za-z0-9]/g, "")}`;
    const providerProductKey = `${stripeProductId}:${stripePriceId}`;
    yield* db.insert(products).values({
      id: productId,
      name: `Stripe Product ${productId}`,
      projectId: CoreTestFixture.projectId,
      slug: productId,
      type: input.type ?? ProductType.Subscription,
    });
    yield* db.insert(paymentProviderConfigurationProducts).values({
      configuration: { priceId: stripePriceId, productId: stripeProductId },
      id: configProductId,
      isActive: true,
      paymentProviderConfigurationId: input.configId,
      productId,
      providerProductKey,
    });
    return {
      configProductId,
      productId,
      providerProductKey,
      stripePriceId,
      stripeProductId,
    } satisfies SeededStripeProduct;
  });

/**
 * Best-effort sweep of every row a Stripe scenario creates: the operational
 * projection keyed on the seeded product mapping, the persons the engine
 * lazily created for the given Stripe customer ids (+ their identity / external
 * rows and ledger rows), the notification-processed rows for the config, and
 * the seeded product + configuration rows. Deepest dependents first.
 */
export const cleanupStripeScenario = (input: {
  readonly configId: string;
  readonly configProductId?: string;
  readonly productId?: string;
  readonly customerIds?: ReadonlyArray<string>;
}) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const customerIds = [...new Set(input.customerIds ?? [])];

    // Resolve the lazily-created persons for the recorded customers; this lookup
    // is a cleanup backstop, so a read failure degrades to "no persons" rather
    // than failing the finalizer (`Effect.ensuring` requires an infallible effect).
    const personIds = yield* Effect.gen(function* () {
      if (customerIds.length === 0) return [] as string[];
      const rows = yield* db.query.personExternalIdentifiers.findMany({
        columns: { personId: true },
        where: {
          projectId: CoreTestFixture.projectId,
          serviceId: "stripe",
          identifier: { in: customerIds },
        },
      });
      return [...new Set(rows.map((row) => row.personId))];
    }).pipe(Effect.catch(() => Effect.succeed([] as string[])));

    if (input.configProductId) {
      yield* db
        .delete(subscriptions)
        .where(eq(subscriptions.paymentProviderConfigurationProductId, input.configProductId!))
        .pipe(Effect.ignore);
      yield* db
        .delete(transactions)
        .where(eq(transactions.paymentProviderConfigurationProductId, input.configProductId!))
        .pipe(Effect.ignore);
      yield* db
        .delete(purchases)
        .where(eq(purchases.paymentProviderConfigurationProductId, input.configProductId!))
        .pipe(Effect.ignore);
    }

    if (personIds.length > 0) {
      yield* db
        .delete(purchaseLedger)
        .where(inArray(purchaseLedger.personId, personIds))
        .pipe(Effect.ignore);
      yield* db
        .delete(personExternalIdentifiers)
        .where(inArray(personExternalIdentifiers.personId, personIds))
        .pipe(Effect.ignore);
      yield* db
        .delete(personIdentities)
        .where(inArray(personIdentities.personId, personIds))
        .pipe(Effect.ignore);
      yield* db.delete(persons).where(inArray(persons.id, personIds)).pipe(Effect.ignore);
    }

    yield* db
      .delete(paymentProviderNotificationProcessed)
      .where(
        eq(paymentProviderNotificationProcessed.paymentProviderConfigurationId, input.configId),
      )
      .pipe(Effect.ignore);

    if (input.configProductId) {
      yield* db
        .delete(paymentProviderConfigurationProducts)
        .where(eq(paymentProviderConfigurationProducts.id, input.configProductId!))
        .pipe(Effect.ignore);
    }
    if (input.productId) {
      yield* db.delete(products).where(eq(products.id, input.productId!)).pipe(Effect.ignore);
    }
    yield* db
      .delete(paymentProviderConfigurations)
      .where(eq(paymentProviderConfigurations.id, input.configId))
      .pipe(Effect.ignore);
  });

// ----------------------------------------------------------------------------
// Stripe event-object builders. All amounts are minor units; use "usd" so FX
// resolves to the identity rate without a network call.
// ----------------------------------------------------------------------------

/** Wraps a `data.object` (+ optional `previous_attributes`) in the event envelope. */
export const makeStripeEvent = (input: {
  readonly id?: string;
  readonly type: string;
  readonly object: Record<string, unknown>;
  readonly previousAttributes?: Record<string, unknown>;
  readonly livemode?: boolean;
  readonly created?: number;
}): Record<string, unknown> => ({
  created: input.created ?? 1_700_000_000,
  data: {
    object: input.object,
    ...(input.previousAttributes ? { previous_attributes: input.previousAttributes } : {}),
  },
  id: input.id ?? generateId("paymentProviderNotification").replace("ppn_", "evt_"),
  livemode: input.livemode ?? false,
  object: "event",
  type: input.type,
});

export const makeStripeInvoice = (input: {
  readonly id: string;
  readonly subscriptionId: string;
  readonly customerId: string;
  readonly stripeProductId: string;
  readonly stripePriceId: string;
  readonly amountPaid: number;
  readonly billingReason: string;
  readonly periodStart?: number;
  readonly periodEnd?: number;
  readonly taxMinor?: number;
  readonly paymentIntentId?: string;
  readonly distinctId?: string;
  readonly created?: number;
  readonly currency?: string;
}): Record<string, unknown> => ({
  amount_paid: input.amountPaid,
  billing_reason: input.billingReason,
  charge: null,
  created: input.created ?? 1_700_000_000,
  currency: input.currency ?? "usd",
  customer: input.customerId,
  id: input.id,
  lines: {
    data: [
      {
        period: {
          end: input.periodEnd ?? 1_702_592_000,
          start: input.periodStart ?? 1_700_000_000,
        },
        price: { id: input.stripePriceId, product: input.stripeProductId },
      },
    ],
  },
  metadata: input.distinctId ? { voidhash_distinct_id: input.distinctId } : {},
  object: "invoice",
  payment_intent: input.paymentIntentId ?? null,
  subscription: input.subscriptionId,
  total: input.amountPaid,
  ...(input.taxMinor !== undefined ? { tax: input.taxMinor } : {}),
});

export const makeStripeSubscription = (input: {
  readonly id: string;
  readonly customerId: string;
  readonly stripeProductId: string;
  readonly stripePriceId: string;
  readonly cancelAtPeriodEnd?: boolean;
  readonly canceledAt?: number;
  readonly endedAt?: number;
  readonly currentPeriodEnd?: number;
  readonly status?: string;
  readonly distinctId?: string;
}): Record<string, unknown> => ({
  cancel_at_period_end: input.cancelAtPeriodEnd ?? false,
  canceled_at: input.canceledAt ?? null,
  current_period_end: input.currentPeriodEnd ?? 1_702_592_000,
  customer: input.customerId,
  ended_at: input.endedAt ?? null,
  id: input.id,
  items: { data: [{ price: { id: input.stripePriceId, product: input.stripeProductId } }] },
  metadata: input.distinctId ? { voidhash_distinct_id: input.distinctId } : {},
  object: "subscription",
  status: input.status ?? "active",
});

export const makeStripeCharge = (input: {
  readonly id: string;
  readonly paymentIntentId: string;
  readonly customerId: string;
  readonly amount: number;
  readonly refunded?: boolean;
  readonly created?: number;
  readonly currency?: string;
}): Record<string, unknown> => ({
  amount: input.amount,
  amount_refunded: input.refunded ? input.amount : 0,
  balance_transaction: `txn_${input.id}`,
  created: input.created ?? 1_700_000_000,
  currency: input.currency ?? "usd",
  customer: input.customerId,
  id: input.id,
  object: "charge",
  payment_intent: input.paymentIntentId,
  refunded: input.refunded ?? false,
});

export const makeStripeCheckoutSession = (input: {
  readonly id: string;
  readonly paymentIntentId: string;
  readonly customerId: string;
  readonly amountTotal: number;
  readonly mode?: string;
  readonly paymentStatus?: string;
  readonly taxMinor?: number;
  readonly clientReferenceId?: string;
  readonly created?: number;
  readonly currency?: string;
}): Record<string, unknown> => ({
  amount_subtotal: input.amountTotal,
  amount_total: input.amountTotal,
  client_reference_id: input.clientReferenceId ?? null,
  created: input.created ?? 1_700_000_000,
  currency: input.currency ?? "usd",
  customer: input.customerId,
  id: input.id,
  mode: input.mode ?? "payment",
  object: "checkout.session",
  payment_intent: input.paymentIntentId,
  payment_status: input.paymentStatus ?? "paid",
  total_details: { amount_tax: input.taxMinor ?? 0 },
});

export const makeStripeRefund = (input: {
  readonly id: string;
  readonly paymentIntentId: string;
  readonly status: string;
  readonly created?: number;
}): Record<string, unknown> => ({
  charge: `ch_${input.id}`,
  created: input.created ?? 1_700_000_000,
  id: input.id,
  object: "refund",
  payment_intent: input.paymentIntentId,
  status: input.status,
});
