/**
 * Integration tests for {@link StripeWebhookHandlerService} — the Stripe webhook
 * ingress — run against the real backend stack provisioned once by
 * `test/_testing/globalSetup.ts` (live PlanetScale DB + ClickHouse + WorkOS).
 *
 * Unlike the App Store webhook handler — whose every branch is gated behind a
 * real Apple-signed JWS chained to Apple's production/sandbox CA (no in-process
 * verification seam, hence that suite is 100% `test.todo`; see
 * `appStore/AppStoreWebhookHandlerService.integration.test.ts`) — the Stripe
 * path verifies a plain HMAC-SHA256 signature over `${t}.${rawBody}` against the
 * per-tenant signing secret stored on the configuration row. The shared test
 * support module re-implements that same HMAC scheme (`signStripePayload`), so a
 * test can forge a *valid* `Stripe-Signature` header against the secret it just
 * seeded and exercise the handler genuinely end-to-end. These tests therefore
 * actually RUN.
 *
 * What the test wires that the harness does not: the webhook handler pulls in
 * the full record engine (`PurchaseProcessingService`, `PersonIdentityService`,
 * `FxRateService`, `PaymentConfigSecretCrypto`) plus an `HttpClient` for the
 * per-tenant Stripe REST enrichment (charge-fee, payment-intent latest-charge,
 * checkout line items). `stripeWebhookHandlerLayer(httpClient)` supplies all of
 * it over a fake `HttpClient` whose canned routes drive the REST enrichment
 * deterministically offline. Money-bearing events use a `"usd"` currency so FX
 * resolves to the identity rate without a network call, and carry a
 * `payment_intent` (`pi_*`) wired to a charge (`ch_*`) via `paymentIntentChargeRoute`
 * + `chargeFeeRoutes` so a transaction row + analytics are emitted.
 *
 * Conventions (mirroring `AppStorePaymentProvider.integration.test.ts`): every
 * test namespaces its ids per call, asserts by-id / by-membership (never global
 * counts), and self-cleans every row it creates via an `Effect.ensuring`
 * `cleanupStripeScenario` finalizer that runs on any exit. Typed failures are
 * asserted with `Effect.flip` + `instanceof`, paired with a DB-state assertion
 * proving nothing leaked.
 */
import { constant } from "@voidhash/lib/lang";
import { Clock, DateTime, Effect, Schema } from "effect";
import { describe, expect } from "vitest";

import { StripeWebhookHandlerService } from "@voidhash/core/services/paymentProviders/stripe/stripe-webhook-handler-service";
import { generateId } from "@voidhash/core/utils";
import { Db } from "@voidhash/db";

import { CoreAuthSession } from "@testing/CoreAuthSession";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";

// The Stripe error classes have no public package subpath, so they are imported
// by relative path into `src` (the unit-test convention in the brief).
import { StripePaymentProviderServiceError } from "../../../../src/services/paymentProviders/stripe/errors.ts";
import {
  TEST_TEST_WEBHOOK_SECRET,
  chargeFeeRoutes,
  cleanupStripeScenario,
  makeStripeEvent,
  makeStripeInvoice,
  paymentIntentChargeRoute,
  seedStripeConfig,
  seedStripeProduct,
  signStripePayload,
  stripeStubHttpClient,
  stripeWebhookHandlerLayer,
  uniq,
} from "./stripe-test-support.ts";

const { test } = CoreIntegrationTestHarness.make();

/** Serialises a Stripe event/invoice fixture to the raw webhook body bytes. */
const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

// ----------------------------------------------------------------------------
// DB read-back helpers (bypass the engine).
// ----------------------------------------------------------------------------

/** Notification-processed rows for a `(configId, event.id)` pair (UNIQUE → at most one). */
const findNotificationRows = (configId: string, eventId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.paymentProviderNotificationProcessed.findMany({
      where: {
        paymentProviderConfigurationId: configId,
        notificationUuid: eventId,
      },
    });
  });

/** Purchase-ledger rows for a logical-event idempotency key (UNIQUE → at most one). */
const findLedgerRows = (idempotencyKey: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.purchaseLedger.findMany({
      where: { idempotencyKey },
    });
  });

const findSubscriptionByStoreId = (storeSubscriptionId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.subscriptions.findFirst({
      where: { storeSubscriptionId },
    });
  });

// ----------------------------------------------------------------------------
// Fake-HttpClient helpers.
// ----------------------------------------------------------------------------

/**
 * A fake `HttpClient` carrying the routes a money-in subscription invoice needs:
 * the payment-intent → latest-charge lookup, then that charge's processing-fee
 * (balance-transaction) lookup. Both keyed on the `pi_*`/`ch_*` ids the invoice
 * references, so the engine's fee enrichment resolves a real commission (rather
 * than the best-effort "fee unavailable" fallback an unmatched route gives).
 */
const moneyInHttpClient = (paymentIntentId: string, chargeId: string) =>
  stripeStubHttpClient([
    paymentIntentChargeRoute({ chargeId, paymentIntentId }),
    ...chargeFeeRoutes({ chargeId, feeMinor: 59 }),
  ]);

/** A unique `pi_*` / matching `ch_*` pair for a money-in event's fee enrichment. */
const moneyInIds = (label: string) => {
  const stable = uniq(label).replace(/[^A-Za-z0-9]/g, "");
  return constant({ chargeId: `ch_${stable}`, paymentIntentId: `pi_${stable}` });
};

/** Sign `rawBody` with the seeded TEST webhook secret at the current second (livemode:false ⇒ test mode). */
const signWithTestSecret = (rawBody: string) =>
  Effect.gen(function* () {
    const nowMillis = yield* Clock.currentTimeMillis;
    return yield* Effect.promise(() =>
      signStripePayload(rawBody, TEST_TEST_WEBHOOK_SECRET, Math.floor(nowMillis / 1000)),
    );
  });

describe("StripeWebhookHandlerService.acceptWebhookEvent", () => {
  test(
    "configuration not found fails with StripePaymentProviderServiceError kind 'not_found' and writes no ledger row",
    Effect.gen(function* () {
      const handler = yield* StripeWebhookHandlerService;
      // A configuration id that was never seeded — the lookup precedes every
      // other side effect.
      const missingConfigId = generateId("paymentProviderConfiguration");
      const invoice = makeStripeInvoice({
        amountPaid: 999,
        billingReason: "subscription_create",
        customerId: uniq("cus"),
        id: uniq("in"),
        stripePriceId: uniq("price"),
        stripeProductId: uniq("prod"),
        subscriptionId: uniq("sub"),
      });
      const eventObject = makeStripeEvent({ object: invoice, type: "invoice.paid" });
      const rawBody = encodeJson(eventObject);
      const signatureHeader = yield* signWithTestSecret(rawBody);

      const error = yield* Effect.flip(
        handler.acceptWebhookEvent({
          paymentProviderConfigurationId: missingConfigId,
          rawBody,
          receivedAt: yield* DateTime.nowAsDate,
          signatureHeader,
        }),
      );
      expect(error).toBeInstanceOf(StripePaymentProviderServiceError);
      if (error instanceof StripePaymentProviderServiceError) {
        expect(error.kind).toBe("not_found");
      }

      // Nothing was written for the missing configuration.
      const rows = yield* findNotificationRows(missingConfigId, eventObject.id);
      expect(rows.length).toBe(0);
    }).pipe(
      // No money-in REST calls are reachable (the lookup fails first); the empty
      // stub never matches.
      Effect.provide(stripeWebhookHandlerLayer(stripeStubHttpClient([]))),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "invalid signature fails with StripePaymentProviderServiceError kind 'signature' and writes no notification row",
    Effect.gen(function* () {
      const handler = yield* StripeWebhookHandlerService;
      const seeded = yield* seedStripeConfig();
      const product = yield* seedStripeProduct({ configId: seeded.configId });

      yield* Effect.gen(function* () {
        const invoice = makeStripeInvoice({
          amountPaid: 999,
          billingReason: "subscription_create",
          customerId: uniq("cus"),
          id: uniq("in"),
          stripePriceId: product.stripePriceId,
          stripeProductId: product.stripeProductId,
          subscriptionId: uniq("sub"),
        });
        const eventObject = makeStripeEvent({ object: invoice, type: "invoice.paid" });
        const rawBody = encodeJson(eventObject);
        // Sign the ORIGINAL body, then tamper it: the stored HMAC no longer
        // matches the delivered bytes, so verification fails.
        const signatureHeader = yield* signWithTestSecret(rawBody);
        const tamperedBody = rawBody.replace(/"amount_paid":999/, '"amount_paid":1');

        const error = yield* Effect.flip(
          handler.acceptWebhookEvent({
            paymentProviderConfigurationId: seeded.configId,
            rawBody: tamperedBody,
            receivedAt: yield* DateTime.nowAsDate,
            signatureHeader,
          }),
        );
        expect(error).toBeInstanceOf(StripePaymentProviderServiceError);
        if (error instanceof StripePaymentProviderServiceError) {
          expect(error.kind).toBe("signature");
        }

        // The signature check precedes the wire-dedup write, so no row exists
        // for this event id.
        const rows = yield* findNotificationRows(seeded.configId, eventObject.id);
        expect(rows.length).toBe(0);
      }).pipe(
        Effect.ensuring(
          cleanupStripeScenario({
            configId: seeded.configId,
            configProductId: product.configProductId,
            productId: product.productId,
          }),
        ),
      );
    }).pipe(
      Effect.provide(stripeWebhookHandlerLayer(stripeStubHttpClient([]))),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "invoice.paid subscription_create with a valid signature applies and persists the notification, subscription, and ledger rows",
    ((ids) =>
      Effect.gen(function* () {
        const handler = yield* StripeWebhookHandlerService;
        const seeded = yield* seedStripeConfig();
        const product = yield* seedStripeProduct({ configId: seeded.configId });
        const customerId = uniq("cus");

        yield* Effect.gen(function* () {
          const invoiceId = uniq("in");
          const subscriptionId = uniq("sub");
          const invoice = makeStripeInvoice({
            amountPaid: 1999,
            billingReason: "subscription_create",
            customerId,
            id: invoiceId,
            paymentIntentId: ids.paymentIntentId,
            stripePriceId: product.stripePriceId,
            stripeProductId: product.stripeProductId,
            subscriptionId,
            taxMinor: 100,
          });
          const eventObject = makeStripeEvent({ object: invoice, type: "invoice.paid" });
          const rawBody = encodeJson(eventObject);
          const eventId = eventObject.id;
          const signatureHeader = yield* signWithTestSecret(rawBody);

          const result = yield* handler.acceptWebhookEvent({
            paymentProviderConfigurationId: seeded.configId,
            rawBody,
            receivedAt: yield* DateTime.nowAsDate,
            signatureHeader,
          });
          expect(result.accepted).toBe(true);
          expect(result.handled).toBe(true);
          expect(result.eventId).toBe(eventId);
          expect(result.eventType).toBe("invoice.paid");

          // Wire-dedup ledger row: applied, stripe/webhook, keyed on event.id.
          const notifRows = yield* findNotificationRows(seeded.configId, eventId);
          expect(notifRows.length).toBe(1);
          const notif = notifRows[0]!;
          expect(notif.providerId).toBe("stripe");
          expect(notif.source).toBe("webhook");
          expect(notif.result).toBe("applied");
          expect(notif.notificationType).toBe("invoice.paid");
          expect(notif.parkedRawPayload).toBeNull();

          // Downstream operational subscription row (keyed on the Stripe sub id).
          const subRow = yield* findSubscriptionByStoreId(subscriptionId);
          expect(subRow).toBeDefined();
          expect(subRow?.paymentProviderConfigurationProductId).toBe(product.configProductId);

          // The append-only purchase-ledger row for the logical purchase event.
          // Anchor = invoice.id, eventType = purchase (subscription_create).
          const ledgerRows = yield* findLedgerRows(`stripe:${invoiceId}:purchase`);
          expect(ledgerRows.length).toBe(1);
          const ledger = ledgerRows[0]!;
          expect(ledger.providerId).toBe("stripe");
          expect(ledger.providerEventType).toBe("invoice.paid");
          expect(ledger.source).toBe("webhook");
          expect(ledger.personId).toBe(subRow?.personId);
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
      }).pipe(
        Effect.provide(
          stripeWebhookHandlerLayer(moneyInHttpClient(ids.paymentIntentId, ids.chargeId)),
        ),
        CoreAuthSession.authenticate(),
      ))(moneyInIds("paid")),
  );

  test(
    "duplicate delivery of the same signed event is deduped to one notification row and one ledger row",
    ((ids) =>
      Effect.gen(function* () {
        const handler = yield* StripeWebhookHandlerService;
        const seeded = yield* seedStripeConfig();
        const product = yield* seedStripeProduct({ configId: seeded.configId });
        const customerId = uniq("cus");

        yield* Effect.gen(function* () {
          const invoiceId = uniq("in");
          const subscriptionId = uniq("sub");
          const invoice = makeStripeInvoice({
            amountPaid: 1999,
            billingReason: "subscription_create",
            customerId,
            id: invoiceId,
            paymentIntentId: ids.paymentIntentId,
            stripePriceId: product.stripePriceId,
            stripeProductId: product.stripeProductId,
            subscriptionId,
          });
          const eventObject = makeStripeEvent({ object: invoice, type: "invoice.paid" });
          const rawBody = encodeJson(eventObject);
          const eventId = eventObject.id;
          const signatureHeader = yield* signWithTestSecret(rawBody);

          const input = {
            paymentProviderConfigurationId: seeded.configId,
            rawBody,
            receivedAt: yield* DateTime.nowAsDate,
            signatureHeader,
          };

          const first = yield* handler.acceptWebhookEvent(input);
          expect(first.handled).toBe(true);
          // Same signed bytes redelivered (Stripe at-least-once delivery).
          const second = yield* handler.acceptWebhookEvent(input);
          expect(second.handled).toBe(true);

          // Exactly one wire-dedup row for (config, event.id) despite two deliveries.
          const notifRows = yield* findNotificationRows(seeded.configId, eventId);
          expect(notifRows.length).toBe(1);

          // Exactly one purchase-ledger row for the logical purchase event — the
          // per-event idempotency key collapses the redelivery.
          const ledgerRows = yield* findLedgerRows(`stripe:${invoiceId}:purchase`);
          expect(ledgerRows.length).toBe(1);
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
      }).pipe(
        Effect.provide(
          stripeWebhookHandlerLayer(moneyInHttpClient(ids.paymentIntentId, ids.chargeId)),
        ),
        CoreAuthSession.authenticate(),
      ))(moneyInIds("dedup")),
  );

  test(
    "invoice.paid for an unmapped price/product parks the notification with the raw payload preserved",
    ((ids) =>
      Effect.gen(function* () {
        const handler = yield* StripeWebhookHandlerService;
        // Seed the configuration but NOT the product mapping — the invoice's
        // price/product key has no active mapping, so the engine parks it.
        const seeded = yield* seedStripeConfig();
        const customerId = uniq("cus");
        const stripeProductId = `prod_${uniq("p").replace(/[^A-Za-z0-9]/g, "")}`;
        const stripePriceId = `price_${uniq("pr").replace(/[^A-Za-z0-9]/g, "")}`;
        const providerProductKey = `${stripeProductId}:${stripePriceId}`;

        yield* Effect.gen(function* () {
          const subscriptionId = uniq("sub");
          const invoice = makeStripeInvoice({
            amountPaid: 1999,
            billingReason: "subscription_create",
            customerId,
            id: uniq("in"),
            paymentIntentId: ids.paymentIntentId,
            stripePriceId,
            stripeProductId,
            subscriptionId,
          });
          const eventObject = makeStripeEvent({ object: invoice, type: "invoice.paid" });
          const rawBody = encodeJson(eventObject);
          const eventId = eventObject.id;
          const signatureHeader = yield* signWithTestSecret(rawBody);

          const result = yield* handler.acceptWebhookEvent({
            paymentProviderConfigurationId: seeded.configId,
            rawBody,
            receivedAt: yield* DateTime.nowAsDate,
            signatureHeader,
          });
          // Parking still acks the webhook (so Stripe stops retrying) and reports
          // it as handled.
          expect(result.accepted).toBe(true);
          expect(result.handled).toBe(true);

          const notifRows = yield* findNotificationRows(seeded.configId, eventId);
          expect(notifRows.length).toBe(1);
          const notif = notifRows[0]!;
          expect(notif.result).toBe("parked_pending_product_mapping");
          expect(notif.parkedUntilProviderProductKey).toBe(providerProductKey);
          // The raw body is preserved verbatim for replay once the mapping
          // appears. The `json` column round-trips the stored string back to the
          // same string (drizzle JSON.stringify on write, JSON.parse on read).
          expect(notif.parkedRawPayload).not.toBeNull();
          expect(notif.parkedRawPayload).toBe(rawBody);

          // No subscription was projected — the product is unmapped.
          const subRow = yield* findSubscriptionByStoreId(subscriptionId);
          expect(subRow).toBeUndefined();
        }).pipe(
          Effect.ensuring(
            cleanupStripeScenario({ configId: seeded.configId, customerIds: [customerId] }),
          ),
        );
      }).pipe(
        Effect.provide(
          stripeWebhookHandlerLayer(moneyInHttpClient(ids.paymentIntentId, ids.chargeId)),
        ),
        CoreAuthSession.authenticate(),
      ))(moneyInIds("park")),
  );

  test(
    "an unhandled event type with a valid signature acks without handling and writes an 'ignored' ledger row",
    Effect.gen(function* () {
      const handler = yield* StripeWebhookHandlerService;
      const seeded = yield* seedStripeConfig();

      yield* Effect.gen(function* () {
        // `customer.created` is not in the engine's event→action map → the match
        // falls through to ack(false).
        const eventObject = makeStripeEvent({
          object: { id: uniq("cus"), object: "customer" },
          type: "customer.created",
        });
        const rawBody = encodeJson(eventObject);
        const eventId = eventObject.id;
        const signatureHeader = yield* signWithTestSecret(rawBody);

        const result = yield* handler.acceptWebhookEvent({
          paymentProviderConfigurationId: seeded.configId,
          rawBody,
          receivedAt: yield* DateTime.nowAsDate,
          signatureHeader,
        });
        expect(result.accepted).toBe(true);
        expect(result.handled).toBe(false);
        expect(result.eventType).toBe("customer.created");

        const notifRows = yield* findNotificationRows(seeded.configId, eventId);
        expect(notifRows.length).toBe(1);
        expect(notifRows[0]!.result).toBe("ignored");
      }).pipe(Effect.ensuring(cleanupStripeScenario({ configId: seeded.configId })));
    }).pipe(
      Effect.provide(stripeWebhookHandlerLayer(stripeStubHttpClient([]))),
      CoreAuthSession.authenticate(),
    ),
  );
});

describe("StripeWebhookHandlerService.replayParkedNotificationsForProductMapping", () => {
  test(
    "replays a parked invoice.paid once the matching product mapping is created: applies it and clears the parked columns",
    ((ids) =>
      Effect.gen(function* () {
        const handler = yield* StripeWebhookHandlerService;
        const seeded = yield* seedStripeConfig();
        const customerId = uniq("cus");
        // Choose the Stripe ids up front so the same mapping can be seeded AFTER
        // the parked delivery (reproducing "event arrived before the mapping").
        const stripeProductId = `prod_${uniq("p").replace(/[^A-Za-z0-9]/g, "")}`;
        const stripePriceId = `price_${uniq("pr").replace(/[^A-Za-z0-9]/g, "")}`;
        const providerProductKey = `${stripeProductId}:${stripePriceId}`;
        // Declared here so the cleanup finalizer can sweep them on any exit.
        let configProductId: string | undefined;
        let productId: string | undefined;

        yield* Effect.gen(function* () {
          const invoiceId = uniq("in");
          const subscriptionId = uniq("sub");
          const invoice = makeStripeInvoice({
            amountPaid: 1999,
            billingReason: "subscription_create",
            customerId,
            id: invoiceId,
            paymentIntentId: ids.paymentIntentId,
            stripePriceId,
            stripeProductId,
            subscriptionId,
          });
          const eventObject = makeStripeEvent({ object: invoice, type: "invoice.paid" });
          const rawBody = encodeJson(eventObject);
          const eventId = eventObject.id;
          const signatureHeader = yield* signWithTestSecret(rawBody);

          // 1. Deliver while unmapped → parked.
          const parkedResult = yield* handler.acceptWebhookEvent({
            paymentProviderConfigurationId: seeded.configId,
            rawBody,
            receivedAt: yield* DateTime.nowAsDate,
            signatureHeader,
          });
          expect(parkedResult.handled).toBe(true);
          const parkedRows = yield* findNotificationRows(seeded.configId, eventId);
          expect(parkedRows[0]!.result).toBe("parked_pending_product_mapping");

          // 2. Operator creates the matching product mapping.
          const product = yield* seedStripeProduct({
            configId: seeded.configId,
            stripePriceId,
            stripeProductId,
          });
          configProductId = product.configProductId;
          productId = product.productId;
          expect(product.providerProductKey).toBe(providerProductKey);

          // 3. Replay the parked rows for this mapping.
          const replay = yield* handler.replayParkedNotificationsForProductMapping({
            paymentProviderConfigurationId: seeded.configId,
            providerProductKey,
          });
          expect(replay.appliedCount).toBe(1);
          expect(replay.failedCount).toBe(0);
          expect(replay.totalParked).toBe(1);

          // The parked row is now applied with its parked columns cleared.
          const resolvedRows = yield* findNotificationRows(seeded.configId, eventId);
          expect(resolvedRows.length).toBe(1);
          const resolved = resolvedRows[0]!;
          expect(resolved.result).toBe("applied");
          expect(resolved.parkedRawPayload).toBeNull();
          expect(resolved.parkedUntilProviderProductKey).toBeNull();

          // The downstream subscription + ledger rows now exist.
          const subRow = yield* findSubscriptionByStoreId(subscriptionId);
          expect(subRow).toBeDefined();
          expect(subRow?.paymentProviderConfigurationProductId).toBe(configProductId);
          const ledgerRows = yield* findLedgerRows(`stripe:${invoiceId}:purchase`);
          expect(ledgerRows.length).toBe(1);
        }).pipe(
          Effect.ensuring(
            // Ids resolved lazily at finalization so cleanup runs even if the
            // mapping was never seeded (early failure).
            Effect.suspend(() =>
              cleanupStripeScenario({
                configId: seeded.configId,
                configProductId,
                customerIds: [customerId],
                productId,
              }),
            ),
          ),
        );
      }).pipe(
        Effect.provide(
          stripeWebhookHandlerLayer(moneyInHttpClient(ids.paymentIntentId, ids.chargeId)),
        ),
        CoreAuthSession.authenticate(),
      ))(moneyInIds("replay")),
  );
});
