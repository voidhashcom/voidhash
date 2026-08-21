/**
 * Integration tests for the outbound lifecycle webhooks that
 * {@link PurchaseProcessingService} publishes when a purchase transition
 * actually changes state, run against the real backend stack provisioned once
 * by `test/_testing/globalSetup.ts` (live PostgreSQL).
 *
 * The layer graph here is the production one, not a stub: the service is wired
 * to the live {@link WebhookEventPublisher} over the real
 * {@link WebhookDispatchService}, so each test asserts the `webhook_delivery`
 * rows that a receiver would actually be sent — payload included, decoded back
 * through the published `api-contracts` schema.
 *
 * What each test pins down:
 *  - exactly one delivery row per *subscribed* endpoint, and none for an active
 *    endpoint subscribed to other events (the per-endpoint event filter),
 *  - a schema-valid payload carrying the person, the subject, and the provider
 *    identifiers the transition knew about,
 *  - no second delivery when the same store notification is redelivered — the
 *    purchase-ledger idempotency key and the row watermarks collapse the replay
 *    before the mapper runs.
 *
 * Conventions:
 *  - {@link withWebhookScenario} seeds the parent rows a purchase action needs
 *    plus two webhook endpoints (one subscribed to the event under test, one
 *    not), and deletes everything — deliveries included — via `Effect.ensuring`.
 *  - `WorkflowRunner` is the recording {@link TestWorkflowRunner}: the delivery
 *    workflow is never executed, so no HTTP leaves the test. Delivery *rows*
 *    are the assertion surface.
 *  - Ids are namespaced per call so a leftover row from a crashed run cannot
 *    collide, and every assertion is scoped by endpoint id.
 */
import { WebhookEventPayload } from "@voidhash/api-contracts";
import { DateTime, Effect, Layer, Option, Schema } from "effect";
import { describe, expect } from "vitest";

import { PerkGrantService } from "@voidhash/core/services";
import {
  type CompleteOneTimePurchaseInput,
  PurchaseProcessingService,
} from "@voidhash/core/services/purchaseProcessing/PurchaseProcessingService";
import { WebhookDispatchService } from "@voidhash/core/services/webhookDispatch/WebhookDispatchService";
import { WebhookEventPublisher } from "@voidhash/core/services/webhookDispatch/WebhookEventPublisher";
import { WebhookServiceError } from "@voidhash/core/services/webhookManager/WebhookManagerService";
import {
  PurchaseProcessingMoney,
  type PurchaseEventSource,
} from "@voidhash/core/domain/purchaseProcessing/PurchaseProcessing";
import type { PaymentProviderId } from "@voidhash/core/domain/paymentProvider/PaymentProviderConfiguration";
import { CurrencyCode, MinorAmount } from "@voidhash/core/domain/shared/Money";
import { PlatformRuntime } from "@voidhash/platform/PlatformRuntime";
import * as TestWorkflowRunner from "@voidhash/platform/TestWorkflowRunner";
import { WorkflowRunner } from "@voidhash/platform/WorkflowRunner";
import {
  type DbError,
  Db,
  ProviderEnvironment,
  WebhookDeliveryStatus,
  WebhookEndpointStatus,
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
  webhookDeliveries,
  webhookEndpoints,
} from "@voidhash/db";

import { CoreAuthSession } from "@testing/CoreAuthSession";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";
import { CoreTestFixture } from "@testing/CoreTestFixture";

const { test } = CoreIntegrationTestHarness.make();

const projectId = CoreTestFixture.projectId;
const organizationId = CoreTestFixture.organizationId;

const instant = (iso: string): Date => DateTime.toDateUtc(DateTime.makeUnsafe(iso));

let seq = 0;
const uniqueKey = (label: string) =>
  `it-ppwh-${label}-${DateTime.toEpochMillis(DateTime.nowUnsafe())}-${seq++}`;

const PROVIDER_ID: PaymentProviderId = "apple-app-store";
const SOURCE: PurchaseEventSource = "webhook";

const money = (gross: number): PurchaseProcessingMoney =>
  new PurchaseProcessingMoney({
    currency: CurrencyCode.make("USD"),
    grossAmount: MinorAmount.make(gross),
    proceedsAfterTaxAmount: MinorAmount.make(gross - Math.round(gross * 0.3)),
    proceedsAmount: MinorAmount.make(gross - Math.round(gross * 0.3)),
    storeCommissionAmount: MinorAmount.make(Math.round(gross * 0.3)),
    storefront: Option.some("USA"),
    taxAmount: MinorAmount.make(0),
    usd: Option.none(),
  });

/**
 * The production layer graph: `PurchaseProcessingService` over the live
 * publisher, with a recording workflow runner standing in for the durable
 * backend. `provideMerge` re-exports the runtime services so the publisher's
 * call-time lookup finds them in the running fiber's context.
 */
const webhookPurchaseProcessingLayer = PurchaseProcessingService.layer.pipe(
  Layer.provide(WebhookEventPublisher.layer.pipe(Layer.provide(WebhookDispatchService.layer))),
  Layer.provideMerge(
    Layer.mergeAll(
      Layer.succeed(WorkflowRunner, TestWorkflowRunner.make()),
      Layer.succeed(PlatformRuntime, PlatformRuntime.of({})),
    ),
  ),
);

/**
 * The live publisher over a broken {@link WebhookDispatchService}. Proves the
 * emission seam can never fail — or roll back — the transition that produced
 * it: a webhook is a side channel, not part of the purchase write.
 *
 * The publisher's other bail-out branch (no `WorkflowRunner` / `PlatformRuntime`
 * in scope) is deliberately not exercised here: `CoreIntegrationTestHarness`
 * puts both in every test's context, so a "runtimeless" layer would not
 * actually be runtimeless. Breaking the dispatch service is the reachable way
 * to fault the seam.
 */
const brokenDispatchPurchaseProcessingLayer = (
  emit: () => Effect.Effect<never, WebhookServiceError>,
) =>
  PurchaseProcessingService.layer.pipe(
    Layer.provide(
      WebhookEventPublisher.layer.pipe(Layer.provide(Layer.succeed(WebhookDispatchService, { emit }))),
    ),
    Layer.provideMerge(
      Layer.mergeAll(
        Layer.succeed(WorkflowRunner, TestWorkflowRunner.make()),
        Layer.succeed(PlatformRuntime, PlatformRuntime.of({})),
      ),
    ),
  );

/** Dispatch fails with its own typed error. */
const failingDispatchPurchaseProcessingLayer = brokenDispatchPurchaseProcessingLayer(() =>
  Effect.fail(new WebhookServiceError({ cause: "dispatch unavailable" })),
);

/** Dispatch dies — an unexpected defect rather than a typed failure. */
const dyingDispatchPurchaseProcessingLayer = brokenDispatchPurchaseProcessingLayer(() =>
  Effect.die(new Error("dispatch exploded")),
);

/**
 * Records what the service publishes, in call order, instead of writing
 * delivery rows. Two rows written in the same millisecond carry no sortable
 * column, so the *order* of a multi-event action is observed at the dispatch
 * seam rather than in the table.
 */
const recordingDispatchPurchaseProcessingLayer = (recorded: Array<string>) =>
  PurchaseProcessingService.layer.pipe(
    Layer.provide(
      WebhookEventPublisher.layer.pipe(
        Layer.provide(
          Layer.succeed(WebhookDispatchService, {
            emit: (input: { readonly eventType: string }) =>
              Effect.sync(() => {
                recorded.push(input.eventType);
                return { deliveriesCreated: 1 };
              }),
          }),
        ),
      ),
    ),
    Layer.provideMerge(
      Layer.mergeAll(
        Layer.succeed(WorkflowRunner, TestWorkflowRunner.make()),
        Layer.succeed(PlatformRuntime, PlatformRuntime.of({})),
      ),
    ),
  );

interface ScenarioIds {
  readonly configurationId: string;
  readonly productId: string;
  readonly productSlug: string;
  readonly configurationProductId: string;
  readonly providerProductKey: string;
  readonly personId: string;
  readonly distinctId: string;
  /** Endpoint subscribed to the event under test. */
  readonly subscribedEndpointId: string;
  /** Active endpoint subscribed to a different event — must receive nothing. */
  readonly otherEndpointId: string;
}

/** Delivery rows written for one endpoint, oldest first. */
const findDeliveriesForEndpoint = (endpointId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.webhookDeliveries.findMany({
      where: { webhookEndpointId: endpointId },
    });
  });

/**
 * Decode a delivery's stored payload through the published union. A decode
 * failure is a contract break, so this deliberately propagates rather than
 * being asserted around.
 */
const decodePayload = Schema.decodeUnknownEffect(WebhookEventPayload);

const cleanupScenario = (ids: ScenarioIds) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const endpointIds = [ids.subscribedEndpointId, ids.otherEndpointId];
    yield* db
      .delete(webhookDeliveries)
      .where(inArray(webhookDeliveries.webhookEndpointId, endpointIds))
      .pipe(Effect.ignore);
    yield* db
      .delete(webhookEndpoints)
      .where(inArray(webhookEndpoints.id, endpointIds))
      .pipe(Effect.ignore);
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
 * Seed a purchase scenario plus the two webhook endpoints the assertions need,
 * run `body`, then delete everything it created. `subscribedEvents` is the
 * event list on the endpoint that should receive the transition's webhook.
 */
const withWebhookScenario = <E, R>(
  label: string,
  subscribedEvents: ReadonlyArray<string>,
  body: (ids: ScenarioIds) => Effect.Effect<void, E, R>,
): Effect.Effect<void, E | DbError, R | Db> =>
  Effect.gen(function* () {
    const db = yield* Db;
    const ids: ScenarioIds = {
      configurationId: uniqueKey(`${label}-conf`),
      configurationProductId: uniqueKey(`${label}-confprod`),
      distinctId: uniqueKey(`${label}-distinct`),
      otherEndpointId: uniqueKey(`${label}-ep-other`),
      personId: uniqueKey(`${label}-person`),
      productId: uniqueKey(`${label}-prod`),
      productSlug: uniqueKey(`${label}-prodslug`),
      providerProductKey: uniqueKey(`${label}-provprodkey`),
      subscribedEndpointId: uniqueKey(`${label}-ep-sub`),
    };

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
      slug: ids.productSlug,
    });
    yield* db.insert(paymentProviderConfigurationProducts).values({
      id: ids.configurationProductId,
      paymentProviderConfigurationId: ids.configurationId,
      productId: ids.productId,
      providerProductKey: ids.providerProductKey,
    });
    yield* db.insert(persons).values({
      id: ids.personId,
      name: "Integration Person",
      primaryDistinctId: ids.distinctId,
      projectId,
    });

    const createdAt = yield* DateTime.nowAsDate;
    yield* db.insert(webhookEndpoints).values({
      consecutiveFailures: 0,
      createdAt,
      events: [...subscribedEvents],
      id: ids.subscribedEndpointId,
      name: `Subscribed ${ids.subscribedEndpointId}`,
      projectId,
      secret: `whsec_${ids.subscribedEndpointId}`,
      status: WebhookEndpointStatus.Active,
      url: `https://example.test/${ids.subscribedEndpointId}`,
    });
    yield* db.insert(webhookEndpoints).values({
      consecutiveFailures: 0,
      createdAt,
      // Deliberately an event no test in this file triggers.
      events: ["person.deleted"],
      id: ids.otherEndpointId,
      name: `Other ${ids.otherEndpointId}`,
      projectId,
      secret: `whsec_${ids.otherEndpointId}`,
      status: WebhookEndpointStatus.Active,
      url: `https://example.test/${ids.otherEndpointId}`,
    });

    return yield* body(ids).pipe(Effect.ensuring(cleanupScenario(ids)));
  });

/** Shared per-action context every purchase method receives. */
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

/**
 * Assert the endpoint received exactly one Pending delivery for `eventType`,
 * that the unsubscribed endpoint received nothing, and return the decoded
 * payload for event-specific assertions.
 */
const expectSingleDelivery = (ids: ScenarioIds, eventType: string) =>
  Effect.gen(function* () {
    const rows = yield* findDeliveriesForEndpoint(ids.subscribedEndpointId);
    expect(rows.length).toBe(1);
    const row = rows[0];
    expect(row?.eventType).toBe(eventType);
    expect(row?.projectId).toBe(projectId);
    expect(row?.status).toBe(WebhookDeliveryStatus.Pending);
    expect(row?.attemptCount).toBe(0);

    const otherRows = yield* findDeliveriesForEndpoint(ids.otherEndpointId);
    expect(otherRows.length).toBe(0);

    return yield* decodePayload(row?.payload);
  });

describe("PurchaseProcessingService webhook emission — subscription.created", () => {
  test(
    "emits one schema-valid delivery per subscribed endpoint and stays silent on redelivery",
    withWebhookScenario("created", ["subscription.created", "subscription.renewed"], (ids) =>
      Effect.gen(function* () {
        const svc = yield* PurchaseProcessingService;
        const idempotencyKey = uniqueKey("created-key");
        const occurredAt = instant("2026-03-01T00:00:00.000Z");
        const storeSubscriptionId = uniqueKey("created-storesub");
        const providerTransactionId = uniqueKey("created-tx");

        const action = {
          ...baseAction(ids, idempotencyKey, occurredAt),
          expiresAt: Option.some(instant("2026-04-01T00:00:00.000Z")),
          isTrial: false,
          money: Option.some(money(9990)),
          providerSubscriptionId: Option.some(storeSubscriptionId),
          providerTransactionId: Option.some(providerTransactionId),
          purchasedAt: occurredAt,
          startsAt: occurredAt,
        };

        yield* svc.startSubscription(action);

        const payload = yield* expectSingleDelivery(ids, "subscription.created");
        if (payload.type !== "subscription.created") {
          return yield* Effect.die(new Error(`expected subscription.created, got ${payload.type}`));
        }
        expect(payload.personId).toBe(ids.personId);
        expect(payload.distinctId).toBe(ids.distinctId);
        expect(payload.projectId).toBe(projectId);
        expect(payload.provider).toBe("apple-app-store");
        expect(payload.environment).toBe("production");
        expect(payload.productId).toBe(ids.productId);
        expect(payload.productSlug).toBe(ids.productSlug);
        expect(payload.providerProductId).toBe(ids.providerProductKey);
        expect(payload.providerSubscriptionId).toBe(storeSubscriptionId);
        expect(payload.providerTransactionId).toBe(providerTransactionId);
        expect(payload.status).toBe("active");
        expect(payload.isTrial).toBe(false);
        expect(payload.occurredAt).toBe(occurredAt.toISOString());
        expect(payload.expiresAt).toBe(instant("2026-04-01T00:00:00.000Z").toISOString());
        expect(payload.amount).toEqual({ currency: "USD", grossAmount: 9990 });
        expect(payload.subscriptionId).toEqual(expect.any(String));

        // Apple redelivers the same notification: same derived idempotency key.
        yield* svc.startSubscription(action);
        const afterReplay = yield* findDeliveriesForEndpoint(ids.subscribedEndpointId);
        expect(afterReplay.length).toBe(1);
      }),
    ).pipe(
      Effect.provide(webhookPurchaseProcessingLayer),
      Effect.provide(PerkGrantService.layer),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "stays silent when the start lands on a subscription row we already track",
    withWebhookScenario("created-existing", ["subscription.created"], (ids) =>
      Effect.gen(function* () {
        const svc = yield* PurchaseProcessingService;
        const occurredAt = instant("2026-03-01T00:00:00.000Z");
        const storeSubscriptionId = uniqueKey("existing-storesub");

        const start = (idempotencyKey: string, providerTransactionId: string) =>
          svc.startSubscription({
            ...baseAction(ids, idempotencyKey, occurredAt),
            expiresAt: Option.some(instant("2026-04-01T00:00:00.000Z")),
            isTrial: false,
            money: Option.some(money(9990)),
            providerSubscriptionId: Option.some(storeSubscriptionId),
            providerTransactionId: Option.some(providerTransactionId),
            purchasedAt: occurredAt,
            startsAt: occurredAt,
          });

        yield* start(uniqueKey("existing-key-a"), uniqueKey("existing-tx-a"));
        // A different ledger key (e.g. the SDK path) for the same series must
        // not announce a second creation.
        yield* start(uniqueKey("existing-key-b"), uniqueKey("existing-tx-b"));

        const rows = yield* findDeliveriesForEndpoint(ids.subscribedEndpointId);
        expect(rows.length).toBe(1);
      }),
    ).pipe(
      Effect.provide(webhookPurchaseProcessingLayer),
      Effect.provide(PerkGrantService.layer),
      CoreAuthSession.authenticate(),
    ),
  );
});

describe("PurchaseProcessingService webhook emission — subscription.renewed", () => {
  test(
    "emits one delivery for the renewal and none for a redelivered notification",
    withWebhookScenario("renewed", ["subscription.renewed"], (ids) =>
      Effect.gen(function* () {
        const svc = yield* PurchaseProcessingService;
        const storeSubscriptionId = uniqueKey("renewed-storesub");
        const startedAt = instant("2026-03-01T00:00:00.000Z");

        yield* svc.startSubscription({
          ...baseAction(ids, uniqueKey("renewed-start-key"), startedAt),
          expiresAt: Option.some(instant("2026-04-01T00:00:00.000Z")),
          isTrial: false,
          money: Option.some(money(9990)),
          providerSubscriptionId: Option.some(storeSubscriptionId),
          providerTransactionId: Option.some(uniqueKey("renewed-start-tx")),
          purchasedAt: startedAt,
          startsAt: startedAt,
        });
        // The endpoint is not subscribed to subscription.created.
        expect((yield* findDeliveriesForEndpoint(ids.subscribedEndpointId)).length).toBe(0);

        const renewedAt = instant("2026-04-01T00:00:00.000Z");
        const renewalTransactionId = uniqueKey("renewed-tx");
        const renewal = {
          ...baseAction(ids, uniqueKey("renewed-key"), renewedAt),
          expiresAt: Option.some(instant("2026-05-01T00:00:00.000Z")),
          isTrial: false,
          money: Option.some(money(9990)),
          providerSubscriptionId: Option.some(storeSubscriptionId),
          providerTransactionId: Option.some(renewalTransactionId),
          renewedAt,
          startsAt: renewedAt,
        };

        yield* svc.renewSubscription(renewal);

        const payload = yield* expectSingleDelivery(ids, "subscription.renewed");
        if (payload.type !== "subscription.renewed") {
          return yield* Effect.die(new Error(`expected subscription.renewed, got ${payload.type}`));
        }
        expect(payload.personId).toBe(ids.personId);
        expect(payload.providerSubscriptionId).toBe(storeSubscriptionId);
        expect(payload.providerTransactionId).toBe(renewalTransactionId);
        expect(payload.renewedAt).toBe(renewedAt.toISOString());
        expect(payload.expiresAt).toBe(instant("2026-05-01T00:00:00.000Z").toISOString());
        expect(payload.status).toBe("active");
        expect(payload.amount).toEqual({ currency: "USD", grossAmount: 9990 });

        yield* svc.renewSubscription(renewal);
        expect((yield* findDeliveriesForEndpoint(ids.subscribedEndpointId)).length).toBe(1);
      }),
    ).pipe(
      Effect.provide(webhookPurchaseProcessingLayer),
      Effect.provide(PerkGrantService.layer),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "announces the creation before the renewal when the renewal is first contact",
    withWebhookScenario(
      "renewed-first",
      ["subscription.created", "subscription.renewed"],
      (ids) =>
        Effect.gen(function* () {
          const svc = yield* PurchaseProcessingService;
          const storeSubscriptionId = uniqueKey("renewed-first-storesub");
          const renewedAt = instant("2026-04-01T00:00:00.000Z");
          const renewalTransactionId = uniqueKey("renewed-first-tx");

          // No start ever reached us: a dropped SUBSCRIBED notification, or an
          // app that moved onto Voidhash mid-subscription.
          const renewal = {
            ...baseAction(ids, uniqueKey("renewed-first-key"), renewedAt),
            expiresAt: Option.some(instant("2026-05-01T00:00:00.000Z")),
            isTrial: false,
            money: Option.some(money(9990)),
            providerSubscriptionId: Option.some(storeSubscriptionId),
            providerTransactionId: Option.some(renewalTransactionId),
            renewedAt,
            startsAt: renewedAt,
          };

          yield* svc.renewSubscription(renewal);

          const rows = yield* findDeliveriesForEndpoint(ids.subscribedEndpointId);
          expect(rows.length).toBe(2);
          expect(rows.map((row) => row.eventType).sort()).toEqual([
            "subscription.created",
            "subscription.renewed",
          ]);
          expect((yield* findDeliveriesForEndpoint(ids.otherEndpointId)).length).toBe(0);

          const created = rows.find((row) => row.eventType === "subscription.created");
          const renewed = rows.find((row) => row.eventType === "subscription.renewed");
          const createdPayload = yield* decodePayload(created?.payload);
          const renewedPayload = yield* decodePayload(renewed?.payload);
          if (
            createdPayload.type !== "subscription.created" ||
            renewedPayload.type !== "subscription.renewed"
          ) {
            return yield* Effect.die(new Error("expected a created + renewed payload pair"));
          }
          // The creation anchors the very subscription the renewal advances.
          expect(createdPayload.subscriptionId).toBe(renewedPayload.subscriptionId);
          expect(createdPayload.personId).toBe(ids.personId);
          expect(createdPayload.providerSubscriptionId).toBe(storeSubscriptionId);
          expect(createdPayload.providerTransactionId).toBe(renewalTransactionId);
          expect(createdPayload.status).toBe("active");
          // The inserted row is stamped with `renewedAt`, so the payload is too.
          expect(createdPayload.purchasedAt).toBe(renewedAt.toISOString());
          expect(createdPayload.startsAt).toBe(renewedAt.toISOString());
          expect(createdPayload.expiresAt).toBe(instant("2026-05-01T00:00:00.000Z").toISOString());
          expect(createdPayload.amount).toEqual({ currency: "USD", grossAmount: 9990 });

          // The store redelivers the same renewal: the ledger key collapses it,
          // so neither event is announced again.
          yield* svc.renewSubscription(renewal);
          expect((yield* findDeliveriesForEndpoint(ids.subscribedEndpointId)).length).toBe(2);
        }),
    ).pipe(
      Effect.provide(webhookPurchaseProcessingLayer),
      Effect.provide(PerkGrantService.layer),
      CoreAuthSession.authenticate(),
    ),
  );

  const recordedRenewalOrder: Array<string> = [];
  test(
    "publishes subscription.created before subscription.renewed",
    withWebhookScenario(
      "renewed-first-order",
      ["subscription.created", "subscription.renewed"],
      (ids) =>
        Effect.gen(function* () {
          const svc = yield* PurchaseProcessingService;
          const renewedAt = instant("2026-04-01T00:00:00.000Z");

          yield* svc.renewSubscription({
            ...baseAction(ids, uniqueKey("renewed-order-key"), renewedAt),
            expiresAt: Option.some(instant("2026-05-01T00:00:00.000Z")),
            isTrial: false,
            money: Option.some(money(9990)),
            providerSubscriptionId: Option.some(uniqueKey("renewed-order-storesub")),
            providerTransactionId: Option.some(uniqueKey("renewed-order-tx")),
            renewedAt,
            startsAt: renewedAt,
          });

          expect(recordedRenewalOrder).toEqual([
            "subscription.created",
            "subscription.renewed",
          ]);
        }),
    ).pipe(
      Effect.provide(recordingDispatchPurchaseProcessingLayer(recordedRenewalOrder)),
      Effect.provide(PerkGrantService.layer),
      CoreAuthSession.authenticate(),
    ),
  );
});

describe("PurchaseProcessingService webhook emission — subscription.cancelled", () => {
  test(
    "emits one delivery for the cancellation and none for a stale replay",
    withWebhookScenario("cancelled", ["subscription.cancelled"], (ids) =>
      Effect.gen(function* () {
        const svc = yield* PurchaseProcessingService;
        const storeSubscriptionId = uniqueKey("cancelled-storesub");
        const startedAt = instant("2026-03-01T00:00:00.000Z");
        const expiresAt = instant("2026-04-01T00:00:00.000Z");

        yield* svc.startSubscription({
          ...baseAction(ids, uniqueKey("cancelled-start-key"), startedAt),
          expiresAt: Option.some(expiresAt),
          isTrial: false,
          money: Option.some(money(9990)),
          providerSubscriptionId: Option.some(storeSubscriptionId),
          providerTransactionId: Option.some(uniqueKey("cancelled-start-tx")),
          purchasedAt: startedAt,
          startsAt: startedAt,
        });

        const canceledAt = instant("2026-03-15T00:00:00.000Z");
        yield* svc.cancelSubscription({
          ...baseAction(ids, uniqueKey("cancelled-key"), canceledAt),
          cancelAtPeriodEnd: true,
          canceledAt,
          cancellationReason: Option.some("user_requested"),
          providerSubscriptionId: Option.some(storeSubscriptionId),
        });

        const payload = yield* expectSingleDelivery(ids, "subscription.cancelled");
        if (payload.type !== "subscription.cancelled") {
          return yield* Effect.die(new Error(`expected subscription.cancelled, got ${payload.type}`));
        }
        expect(payload.personId).toBe(ids.personId);
        expect(payload.cancelAtPeriodEnd).toBe(true);
        expect(payload.cancellationReason).toBe("user_requested");
        expect(payload.canceledAt).toBe(canceledAt.toISOString());
        expect(payload.expiresAt).toBe(expiresAt.toISOString());
        // cancelAtPeriodEnd keeps access until the period ends.
        expect(payload.status).toBe("active");

        // An out-of-order redelivery under a fresh ledger key is rejected by
        // the row watermark, so it must not announce a second cancellation.
        const stale = instant("2026-03-10T00:00:00.000Z");
        yield* svc.cancelSubscription({
          ...baseAction(ids, uniqueKey("cancelled-key-stale"), stale),
          cancelAtPeriodEnd: true,
          canceledAt: stale,
          cancellationReason: Option.some("user_requested"),
          providerSubscriptionId: Option.some(storeSubscriptionId),
        });
        expect((yield* findDeliveriesForEndpoint(ids.subscribedEndpointId)).length).toBe(1);

        // The same cancellation re-observed under a *fresh* ledger key at the
        // identical instant. The row watermark compares `<=`, so the UPDATE
        // still matches — only the pre-update state comparison stops a second
        // announcement.
        yield* svc.cancelSubscription({
          ...baseAction(ids, uniqueKey("cancelled-key-replay"), canceledAt),
          cancelAtPeriodEnd: true,
          canceledAt,
          cancellationReason: Option.some("user_requested"),
          providerSubscriptionId: Option.some(storeSubscriptionId),
        });
        expect((yield* findDeliveriesForEndpoint(ids.subscribedEndpointId)).length).toBe(1);
      }),
    ).pipe(
      Effect.provide(webhookPurchaseProcessingLayer),
      Effect.provide(PerkGrantService.layer),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "stays silent when no subscription row matches the notification",
    withWebhookScenario("cancelled-missing", ["subscription.cancelled"], (ids) =>
      Effect.gen(function* () {
        const svc = yield* PurchaseProcessingService;
        const canceledAt = instant("2026-03-15T00:00:00.000Z");

        yield* svc.cancelSubscription({
          ...baseAction(ids, uniqueKey("cancelled-missing-key"), canceledAt),
          cancelAtPeriodEnd: false,
          canceledAt,
          cancellationReason: Option.none(),
          providerSubscriptionId: Option.some(uniqueKey("cancelled-missing-storesub")),
        });

        expect((yield* findDeliveriesForEndpoint(ids.subscribedEndpointId)).length).toBe(0);
      }),
    ).pipe(
      Effect.provide(webhookPurchaseProcessingLayer),
      Effect.provide(PerkGrantService.layer),
      CoreAuthSession.authenticate(),
    ),
  );
});

describe("PurchaseProcessingService webhook emission — subscription.expired", () => {
  test(
    "emits one delivery for the expiry and none for a redelivered notification",
    withWebhookScenario("expired", ["subscription.expired"], (ids) =>
      Effect.gen(function* () {
        const svc = yield* PurchaseProcessingService;
        const storeSubscriptionId = uniqueKey("expired-storesub");
        const startedAt = instant("2026-03-01T00:00:00.000Z");

        yield* svc.startSubscription({
          ...baseAction(ids, uniqueKey("expired-start-key"), startedAt),
          expiresAt: Option.some(instant("2026-04-01T00:00:00.000Z")),
          isTrial: false,
          money: Option.some(money(9990)),
          providerSubscriptionId: Option.some(storeSubscriptionId),
          providerTransactionId: Option.some(uniqueKey("expired-start-tx")),
          purchasedAt: startedAt,
          startsAt: startedAt,
        });

        const expiredAt = instant("2026-04-01T00:00:00.000Z");
        const expiry = {
          ...baseAction(ids, uniqueKey("expired-key"), expiredAt),
          expiredAt,
          providerSubscriptionId: Option.some(storeSubscriptionId),
        };

        yield* svc.expireSubscription(expiry);

        const payload = yield* expectSingleDelivery(ids, "subscription.expired");
        if (payload.type !== "subscription.expired") {
          return yield* Effect.die(new Error(`expected subscription.expired, got ${payload.type}`));
        }
        expect(payload.personId).toBe(ids.personId);
        expect(payload.providerSubscriptionId).toBe(storeSubscriptionId);
        expect(payload.expiredAt).toBe(expiredAt.toISOString());
        expect(payload.status).toBe("canceled");

        yield* svc.expireSubscription(expiry);
        expect((yield* findDeliveriesForEndpoint(ids.subscribedEndpointId)).length).toBe(1);

        // Same expiry, fresh ledger key, identical instant — the row is already
        // expired, so nothing is announced.
        yield* svc.expireSubscription({
          ...expiry,
          idempotencyKey: uniqueKey("expired-key-replay"),
        });
        expect((yield* findDeliveriesForEndpoint(ids.subscribedEndpointId)).length).toBe(1);
      }),
    ).pipe(
      Effect.provide(webhookPurchaseProcessingLayer),
      Effect.provide(PerkGrantService.layer),
      CoreAuthSession.authenticate(),
    ),
  );
});

describe("PurchaseProcessingService webhook emission — purchase.completed", () => {
  test(
    "emits one delivery for a new purchase row and none for a redelivered notification",
    withWebhookScenario("completed", ["purchase.completed"], (ids) =>
      Effect.gen(function* () {
        const svc = yield* PurchaseProcessingService;
        const purchasedAt = instant("2026-03-01T00:00:00.000Z");
        const providerTransactionId = uniqueKey("completed-tx");
        const action: CompleteOneTimePurchaseInput = {
          ...baseAction(ids, uniqueKey("completed-key"), purchasedAt),
          money: Option.some(money(4990)),
          providerTransactionId: Option.some(providerTransactionId),
          purchaseType: "one-time",
          purchasedAt,
        };

        yield* svc.completeOneTimePurchase(action);

        const payload = yield* expectSingleDelivery(ids, "purchase.completed");
        if (payload.type !== "purchase.completed") {
          return yield* Effect.die(new Error(`expected purchase.completed, got ${payload.type}`));
        }
        expect(payload.personId).toBe(ids.personId);
        expect(payload.distinctId).toBe(ids.distinctId);
        expect(payload.productId).toBe(ids.productId);
        expect(payload.providerKey).toBe(providerTransactionId);
        expect(payload.providerTransactionId).toBe(providerTransactionId);
        expect(payload.purchaseKind).toBe("one_time");
        expect(payload.purchasedAt).toBe(purchasedAt.toISOString());
        expect(payload.amount).toEqual({ currency: "USD", grossAmount: 4990 });
        expect(payload.purchaseId).toEqual(expect.any(String));

        yield* svc.completeOneTimePurchase(action);
        expect((yield* findDeliveriesForEndpoint(ids.subscribedEndpointId)).length).toBe(1);
      }),
    ).pipe(
      Effect.provide(webhookPurchaseProcessingLayer),
      Effect.provide(PerkGrantService.layer),
      CoreAuthSession.authenticate(),
    ),
  );
});

describe("PurchaseProcessingService webhook emission — purchase.refunded", () => {
  test(
    "emits one delivery carrying the original charge and none for a stale replay",
    withWebhookScenario("refunded", ["purchase.refunded"], (ids) =>
      Effect.gen(function* () {
        const svc = yield* PurchaseProcessingService;
        const purchasedAt = instant("2026-03-01T00:00:00.000Z");
        const providerTransactionId = uniqueKey("refunded-tx");

        yield* svc.completeOneTimePurchase({
          ...baseAction(ids, uniqueKey("refunded-buy-key"), purchasedAt),
          money: Option.some(money(4990)),
          providerTransactionId: Option.some(providerTransactionId),
          purchaseType: "one-time",
          purchasedAt,
        });
        // The endpoint is not subscribed to purchase.completed.
        expect((yield* findDeliveriesForEndpoint(ids.subscribedEndpointId)).length).toBe(0);

        const refundedAt = instant("2026-03-05T00:00:00.000Z");
        yield* svc.refundPurchase({
          ...baseAction(ids, uniqueKey("refunded-key"), refundedAt),
          providerTransactionId: Option.some(providerTransactionId),
          refundReason: Option.some("customer_request"),
          refundedAt,
        });

        const payload = yield* expectSingleDelivery(ids, "purchase.refunded");
        if (payload.type !== "purchase.refunded") {
          return yield* Effect.die(new Error(`expected purchase.refunded, got ${payload.type}`));
        }
        expect(payload.personId).toBe(ids.personId);
        expect(payload.providerTransactionId).toBe(providerTransactionId);
        expect(payload.refundReason).toBe("customer_request");
        expect(payload.refundedAt).toBe(refundedAt.toISOString());
        // Money is reconstructed from the stored transaction row.
        expect(payload.amount).toEqual({ currency: "USD", grossAmount: 4990 });
        expect(payload.purchaseId).toEqual(expect.any(String));

        // A stale redelivery under a fresh ledger key is rejected by both
        // watermarks, so nothing new is announced.
        const stale = instant("2026-03-02T00:00:00.000Z");
        yield* svc.refundPurchase({
          ...baseAction(ids, uniqueKey("refunded-key-stale"), stale),
          providerTransactionId: Option.some(providerTransactionId),
          refundReason: Option.some("customer_request"),
          refundedAt: stale,
        });
        expect((yield* findDeliveriesForEndpoint(ids.subscribedEndpointId)).length).toBe(1);

        // Same refund, fresh ledger key, identical instant: both rows already
        // carry this `refundedAt`, so no second announcement.
        yield* svc.refundPurchase({
          ...baseAction(ids, uniqueKey("refunded-key-replay"), refundedAt),
          providerTransactionId: Option.some(providerTransactionId),
          refundReason: Option.some("customer_request"),
          refundedAt,
        });
        expect((yield* findDeliveriesForEndpoint(ids.subscribedEndpointId)).length).toBe(1);
      }),
    ).pipe(
      Effect.provide(webhookPurchaseProcessingLayer),
      Effect.provide(PerkGrantService.layer),
      CoreAuthSession.authenticate(),
    ),
  );
});

describe("PurchaseProcessingService webhook emission — failure isolation", () => {
  test(
    "completes the transition and writes its rows when webhook dispatch fails",
    withWebhookScenario("isolated", ["subscription.created"], (ids) =>
      Effect.gen(function* () {
        const svc = yield* PurchaseProcessingService;
        const db = yield* Db;
        const occurredAt = instant("2026-03-01T00:00:00.000Z");
        const storeSubscriptionId = uniqueKey("isolated-storesub");

        // Succeeds despite the publisher's dispatch failing underneath: the
        // error is swallowed and logged, never surfaced to the caller.
        const result = yield* svc.startSubscription({
          ...baseAction(ids, uniqueKey("isolated-key"), occurredAt),
          expiresAt: Option.some(instant("2026-04-01T00:00:00.000Z")),
          isTrial: false,
          money: Option.some(money(9990)),
          providerSubscriptionId: Option.some(storeSubscriptionId),
          providerTransactionId: Option.some(uniqueKey("isolated-tx")),
          purchasedAt: occurredAt,
          startsAt: occurredAt,
        });

        expect(Option.isSome(result.subscriptionId)).toBe(true);
        const subRow = yield* db.query.subscriptions.findFirst({
          where: {
            paymentProviderConfigurationProductId: ids.configurationProductId,
            storeSubscriptionId,
          },
        });
        // The purchase write committed in full — it does not roll back with
        // the webhook.
        expect(subRow).toBeDefined();
        expect(subRow?.personId).toBe(ids.personId);
        expect((yield* findDeliveriesForEndpoint(ids.subscribedEndpointId)).length).toBe(0);
      }),
    ).pipe(
      Effect.provide(failingDispatchPurchaseProcessingLayer),
      Effect.provide(PerkGrantService.layer),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "completes the transition when the publisher's dispatch dies with a defect",
    withWebhookScenario("isolated-defect", ["purchase.completed"], (ids) =>
      Effect.gen(function* () {
        const svc = yield* PurchaseProcessingService;
        const purchasedAt = instant("2026-03-01T00:00:00.000Z");

        const result = yield* svc.completeOneTimePurchase({
          ...baseAction(ids, uniqueKey("isolated-defect-key"), purchasedAt),
          money: Option.some(money(4990)),
          providerTransactionId: Option.some(uniqueKey("isolated-defect-tx")),
          purchaseType: "one-time",
          purchasedAt,
        });

        // A defect — not a typed failure — must be contained just the same.
        expect(Option.isSome(result.purchaseId)).toBe(true);
        expect((yield* findDeliveriesForEndpoint(ids.subscribedEndpointId)).length).toBe(0);
      }),
    ).pipe(
      Effect.provide(dyingDispatchPurchaseProcessingLayer),
      Effect.provide(PerkGrantService.layer),
      CoreAuthSession.authenticate(),
    ),
  );
});
