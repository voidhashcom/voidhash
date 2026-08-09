/**
 * Integration tests for the public {@link StripePaymentProviderService} boundary
 * — specifically its live implementation `StripePaymentProviderServiceLive` and
 * the single public method `acceptWebhookEvent`
 * (`src/services/paymentProviders/stripe/payment-provider-service.ts`), which
 * delegates verbatim to {@link StripeWebhookHandlerService.acceptWebhookEvent}.
 *
 * Mirrors the App Store public-service suite
 * (`appStore/AppStorePaymentProviderService.integration.test.ts`), but Stripe
 * has NO hard SDK wall: the `Stripe-Signature` HMAC is a plain SHA-256 over
 * `${t}.${rawBody}` and is fully reproducible in-process via the test-support
 * `signStripePayload` signer, and the engine's REST enrichment (charge fee,
 * payment-intent latest charge) is driven by a fake `HttpClient`. So the happy
 * path runs end-to-end against the real harness `Db`, persisting the downstream
 * operational rows — not just returning a `StripeAcceptWebhookEventResult`.
 *
 * Two branches run in-process:
 *  - configuration-not-found: with no configuration row for the given id, the
 *    handler fails `StripePaymentProviderConfigurationNotFoundError` BEFORE any
 *    signature/engine work, and the public boundary collapses it into a
 *    `StripePaymentProviderServiceError` with `kind: "not_found"`.
 *  - happy path: seed config + product, sign a valid `invoice.paid`
 *    (billing_reason="subscription_create" → startSubscription) with the TEST
 *    webhook secret, call the public `acceptWebhookEvent`, assert
 *    `{ accepted: true, handled: true }`, and read back the persisted
 *    `subscription` row. The invoice carries a `payment_intent` ("pi_*") and the
 *    fake `HttpClient` routes its latest-charge + balance-transaction fee, so
 *    the money-bearing transaction is written. USD everywhere → identity FX rate
 *    offline.
 *
 * Conventions follow the engine suite: per-test unique ids, by-id assertions
 * (never global counts), and a `cleanupStripeScenario` sweep of every row the
 * scenario created (operational projection + lazily-created persons + the
 * notification-dedup + the seeded config/product rows).
 */
import { Clock, DateTime, Effect, Schema } from "effect";
import { describe, expect, test as vitestTest } from "vitest";

import {
  StripePaymentProviderService,
  StripePaymentProviderServiceError,
} from "@voidhash/core/services";
import { Db } from "@voidhash/db";

import {
  cleanupStripeScenario,
  makeStripeEvent,
  makeStripeInvoice,
  noStripeRestHttpClient,
  paymentIntentChargeRoute,
  chargeFeeRoutes,
  seedStripeConfig,
  seedStripeProduct,
  signStripePayload,
  stripeServiceLayer,
  stripeStubHttpClient,
  TEST_TEST_WEBHOOK_SECRET,
  uniq,
} from "./stripe-test-support.ts";

import { CoreAuthSession } from "@testing/CoreAuthSession";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";

const { test } = CoreIntegrationTestHarness.make();

const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

/** Current unix time in whole seconds — the unit Stripe signatures are stamped in. */
const nowSeconds = Effect.map(Clock.currentTimeMillis, (millis) => Math.floor(millis / 1000));

/** Reads back the operational subscription row keyed on the Stripe subscription id. */
const findSubscriptionByStoreId = (storeSubscriptionId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.subscriptions.findFirst({
      where: { storeSubscriptionId },
    });
  });

describe("StripePaymentProviderService.acceptWebhookEvent", () => {
  // --- Configuration-not-found (RUNNABLE, pre-signature) ----------------------
  // With no configuration row for the input id, the handler short-circuits at
  // the very first DB read (before any signature work), and the public boundary
  // collapses `StripePaymentProviderConfigurationNotFoundError` into a
  // `StripePaymentProviderServiceError` tagged `kind: "not_found"`. Nothing is
  // seeded and nothing is written — there is nothing to clean up.
  test(
    "configuration-not-found fails StripePaymentProviderServiceError with kind 'not_found'",
    Effect.gen(function* () {
      const service = yield* StripePaymentProviderService;

      const error = yield* Effect.flip(
        service.acceptWebhookEvent({
          paymentProviderConfigurationId: uniq("missing-config"),
          rawBody: "{}",
          receivedAt: yield* DateTime.nowAsDate,
          signatureHeader: "t=0,v1=deadbeef",
        }),
      );

      expect(error).toBeInstanceOf(StripePaymentProviderServiceError);
      expect(error.kind).toBe("not_found");
      expect(typeof error.cause).toBe("string");
    }).pipe(
      Effect.provide(stripeServiceLayer(noStripeRestHttpClient())),
      CoreAuthSession.authenticate(),
    ),
  );

  // --- Happy path: invoice.paid → startSubscription (RUNNABLE, end-to-end) ----
  // A `subscription_create` invoice routes to startSubscription, which persists
  // the subscription/transaction/purchase rows + 2 ledger rows. The invoice
  // carries `payment_intent: pi_*`; the fake HttpClient resolves its latest
  // charge (ch_*) and that charge's balance-transaction fee, so the money-
  // bearing transaction is written. USD → identity FX offline. The signature is
  // a real HMAC over the body with the TEST webhook secret, so the public
  // verify-and-decode path runs unmocked and `mode` resolves to "test".
  test(
    "happy path: a valid invoice.paid (subscription_create) is accepted, handled, and persists the subscription",
    Effect.gen(function* () {
      const seeded = yield* seedStripeConfig();
      const product = yield* seedStripeProduct({ configId: seeded.configId });

      const customerId = uniq("cus");
      const subscriptionId = uniq("sub");
      const paymentIntentId = `pi_${uniq("pi").replace(/[^A-Za-z0-9]/g, "")}`;
      const chargeId = `ch_${paymentIntentId}`;

      const invoice = makeStripeInvoice({
        amountPaid: 1999,
        billingReason: "subscription_create",
        customerId,
        distinctId: uniq("distinct"),
        id: uniq("in"),
        paymentIntentId,
        stripePriceId: product.stripePriceId,
        stripeProductId: product.stripeProductId,
        subscriptionId,
      });
      const event = makeStripeEvent({
        id: `evt_${uniq("e").replace(/[^A-Za-z0-9]/g, "")}`,
        object: invoice,
        type: "invoice.paid",
      });

      const rawBody = encodeJson(event);
      const signatureSeconds = yield* nowSeconds;
      const signatureHeader = yield* Effect.promise(() =>
        signStripePayload(rawBody, TEST_TEST_WEBHOOK_SECRET, signatureSeconds),
      );

      const httpClient = stripeStubHttpClient([
        paymentIntentChargeRoute({ chargeId, paymentIntentId }),
        ...chargeFeeRoutes({ chargeId, feeMinor: 100 }),
      ]);

      const run = Effect.gen(function* () {
        const service = yield* StripePaymentProviderService;
        return yield* service.acceptWebhookEvent({
          paymentProviderConfigurationId: seeded.configId,
          rawBody,
          receivedAt: yield* DateTime.nowAsDate,
          signatureHeader,
        });
      }).pipe(Effect.provide(stripeServiceLayer(httpClient)), CoreAuthSession.authenticate());

      yield* Effect.gen(function* () {
        const result = yield* run;

        expect(result.accepted).toBe(true);
        expect(result.handled).toBe(true);
        expect(result.eventType).toBe("invoice.paid");
        expect(result.eventId).toBe(event.id);

        // The downstream operational projection: a subscription row keyed on the
        // Stripe subscription id, mapped to the seeded provider-product.
        const subscription = yield* findSubscriptionByStoreId(subscriptionId);
        expect(subscription).toBeDefined();
        expect(subscription?.paymentProviderConfigurationProductId).toBe(product.configProductId);
      }).pipe(
        Effect.ensuring(
          cleanupStripeScenario({
            configId: seeded.configId,
            configProductId: product.configProductId,
            customerIds: [customerId],
            productId: product.productId,
          }),
        ),
      );
    }),
  );

  // The remaining record-engine branches (renew / cancel / expire / refund /
  // one-time checkout / reverse-refund / dispute) are exercised directly against
  // the record engine in the sibling `StripePaymentProvider` engine suite; the
  // public-service suite only needs to prove the boundary delegates and the two
  // boundary-collapse semantics (not_found short-circuit + handled happy path).
  vitestTest.todo(
    "renew / cancel / expire / refund / checkout branches — covered by the StripePaymentProvider engine integration suite (the public boundary is a thin delegate to the same handler)",
  );
});
