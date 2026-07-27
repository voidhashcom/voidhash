/**
 * Stripe record engine — normalizes verified Stripe webhook events into calls
 * on the provider-neutral `PurchaseProcessingService`. The downstream purchase/
 * subscription/transaction writes, idempotency ledger, and revenue-analytics
 * staging are entirely reused; this engine only builds the normalized
 * `PurchaseActionContext` + `PurchaseProcessingMoney` per event and routes to
 * the matching action. Mirrors `appStore/payment-provider.ts`.
 *
 * Two `StripePaymentProvider` tags exist (as for App Store): the config-write
 * adapter (`PaymentProvider.ts`, used by the admin config flow) and THIS record
 * engine (`core/StripePaymentProvider`).
 *
 * Known v1 scope boundaries (intentional; not defects):
 *  - Only FULL refunds (`charge.refunded` with `refunded === true`) are
 *    reflected; partial/cumulative refunds are deferred.
 *  - Disputes: only `charge.dispute.closed` with `status === "lost"` reduces
 *    revenue (treated as a chargeback). `charge.dispute.created` (funds held at
 *    open) is NOT recorded to avoid double-counting against the close.
 *  - `isTrial` is inferred from a zero amount (`gross === 0`); a 100%-off paid
 *    invoice is flagged as a trial. This never affects the net-revenue SUM
 *    (gross is 0 either way) — only trial-conversion analytics.
 *  - Subscription lifecycle events (cancel / expire / billing-retry / resume /
 *    product-change) emit analytics only when a local subscription row already
 *    exists; one created before our first recorded invoice self-heals on the
 *    next renewal (which creates the row).
 *  - Plan migrations (`customer.subscription.updated` item change) are recorded
 *    best-effort as a renewal-preference change; a cross-product migration may
 *    surface as a fresh subscription row on the next renewal.
 *  - A refund/dispute whose original transaction is not found (untracked charge,
 *    or delivered before the purchase webhook) is acknowledged + logged, not
 *    retried; Stripe ordinarily delivers the charge/invoice before its refund.
 */
import {
  type PaymentProviderConfiguration as DbPaymentProviderConfiguration,
  type PersonOriginValue,
  type Project as DbProject,
  type ProviderEnvironmentValue,
  PersonOrigin,
} from "@voidhash/db";
import { ProductType } from "@voidhash/lib/constants";
import { Context, Effect, Layer, Option, Schema } from "effect";
import { HttpClient } from "effect/unstable/http/HttpClient";

import { PurchaseProcessingResult } from "../../../domain/purchaseProcessing/PurchaseProcessing.ts";
import {
  type PurchaseActionContext,
  PurchaseProcessingService,
} from "../../purchaseProcessing/PurchaseProcessingService.ts";
import { FxRateService } from "../../fxRates/FxRateService.ts";
import { PersonIdentityService } from "../../personIdentity/PersonIdentityService.ts";
import { PaymentConfigSecretCrypto } from "../../../utils/crypto/PaymentConfigSecretCrypto.ts";
import { generateId } from "../../../utils/index.ts";
import { globalConfigurationSchema } from "./config-provider.ts";
import {
  StripePaymentProviderProductNotMappedError,
  StripePaymentProviderServiceError,
} from "./errors.ts";
import {
  decodeStripeObject,
  StripeChargeSchema,
  StripeCheckoutSessionSchema,
  type StripeEvent,
  StripeInvoiceSchema,
  StripeRefundSchema,
  StripeDisputeSchema,
  type StripeSubscriptionPreviousAttributes,
  StripeSubscriptionPreviousAttributesSchema,
  StripeSubscriptionSchema,
} from "./events.ts";
import {
  type StripePurchaseProcessingEventType,
  buildStripeWebhookAnonymousDistinctId,
  chargeStorefront,
  extractStripeDistinctId,
  getStripeIdempotencyKey,
  invoicePrimaryPriceProduct,
  invoiceTaxMinor,
  isPaidOneTimeCheckout,
  resolveChargeKey,
  STRIPE_EXTERNAL_IDENTIFIER_SERVICE_ID,
  stripeProviderProductKey,
  subscriptionPrimaryPriceProduct,
} from "./helpers.ts";
import { buildStripeMoney } from "./money.ts";
import { StripePaymentProviderServiceQueries } from "./payment-provider-service-queries.ts";
import { buildStripeContext, type StripeContext, type StripeMode } from "./sdk-context.ts";

/** Re-export so importers of the Stripe config schema can reach it from the engine module. */
export { globalConfigurationSchema };

/**
 * Shared base accepted by every `record*` method. The webhook handler resolves
 * `configuration` / `project` and builds `stripeContext` (verifier + REST
 * helpers) once, then passes them in — re-decrypting per record would be
 * wasteful.
 */
export interface StripeRecordInput {
  readonly configuration: DbPaymentProviderConfiguration;
  readonly project: DbProject;
  readonly event: StripeEvent;
  readonly mode: StripeMode;
  readonly stripeContext: StripeContext;
  readonly providerEnvironment: ProviderEnvironmentValue;
  readonly receivedAt: Date;
  readonly source: "webhook" | "reconciliation";
}

const fromUnixSeconds = (seconds: number | null | undefined, fallback: Date): Date =>
  typeof seconds === "number" ? new Date(seconds * 1000) : fallback;

const makeIgnored = (): PurchaseProcessingResult =>
  new PurchaseProcessingResult({
    analyticsEventIds: [],
    changedGrantIds: [],
    idempotent: true,
    personId: "",
    purchaseId: Option.none(),
    subscriptionId: Option.none(),
    transactionId: Option.none(),
  });

const make = Effect.gen(function* () {
  const queries = yield* StripePaymentProviderServiceQueries;
  const personIdentityService = yield* PersonIdentityService;
  const purchaseProcessingService = yield* PurchaseProcessingService;
  // Captured at construction so the FX requirement never propagates into each
  // `record*` method's `R` channel (mirrors the App Store engine).
  const fxRateService = yield* FxRateService;
  const secretCrypto = yield* PaymentConfigSecretCrypto;
  // Shared HTTP pool for per-tenant Stripe REST calls (fee / line-item lookups).
  const httpClient = yield* HttpClient;

  /**
   * Decrypts the tenant's Stripe secrets and builds the per-tenant context
   * (signature verifier + REST helpers). Rows written before the encryption
   * seam are plaintext and pass through `decrypt`.
   */
  const buildContextFromConfiguration = Effect.fn("buildContextFromConfiguration")(function* (
    configuration: DbPaymentProviderConfiguration,
  ) {
    yield* Effect.annotateCurrentSpan(
      "voidhash.payment_provider.configuration_id",
      configuration.id,
    );
    yield* Effect.annotateCurrentSpan("voidhash.project.id", configuration.projectId);
    const parsed = yield* Schema.decodeUnknownEffect(globalConfigurationSchema)(
      configuration.configuration,
    );
    const [liveSecretKey, liveWebhookSecret, testSecretKey, testWebhookSecret] = yield* Effect.all([
      secretCrypto.decrypt(parsed.live.secretKey),
      secretCrypto.decrypt(parsed.live.webhookSecret),
      secretCrypto.decrypt(parsed.test.secretKey),
      secretCrypto.decrypt(parsed.test.webhookSecret),
    ]);
    return buildStripeContext({
      httpClient,
      liveSecretKey,
      liveWebhookSecret,
      testSecretKey,
      testWebhookSecret,
    });
  });

  const _resolveDistinctIdToPersonId = Effect.fn("_resolveDistinctIdToPersonId")(function* (input: {
    readonly distinctId: string;
    readonly eventTimestamp: Date;
    readonly projectId: string;
    readonly origin?: PersonOriginValue;
  }) {
    const result = yield* personIdentityService.resolveDistinctId({
      distinctId: input.distinctId,
      eventTimestamp: input.eventTimestamp,
      origin: input.origin ?? PersonOrigin.Stripe,
      projectId: input.projectId,
      setAttributes: {},
      setOnceAttributes: {},
      shouldCreatePerson: true,
    });
    if (!result.identity.personId) {
      return yield* new StripePaymentProviderServiceError({
        cause: "Stripe event resolved without person id",
      });
    }
    return result.identity.personId;
  });

  /**
   * Layered Stripe identity resolution:
   *  1. a stamped voidhash distinctId (`client_reference_id` / metadata) →
   *     resolve/create that person, and (re)bind the Stripe customer to it.
   *  2. else an existing `stripe` external identifier on the customer id →
   *     canonicalized person.
   *  3. else a synthetic `PersonOrigin.Stripe` stand-in keyed on the customer,
   *     bound to the customer id for future events.
   */
  const _resolveStripePerson = Effect.fn("_resolveStripePerson")(function* (input: {
    readonly projectId: string;
    readonly distinctId: string | undefined;
    readonly customerId: string | undefined;
    readonly providerEnvironment: ProviderEnvironmentValue;
    readonly occurredAt: Date;
  }) {
    if (input.distinctId) {
      const personId = yield* _resolveDistinctIdToPersonId({
        distinctId: input.distinctId,
        eventTimestamp: input.occurredAt,
        projectId: input.projectId,
      });
      if (input.customerId) {
        yield* queries.upsertExternalIdentifier({
          id: generateId("personDistinctId"),
          identifier: input.customerId,
          isDefault: true,
          personId,
          projectId: input.projectId,
          serviceId: STRIPE_EXTERNAL_IDENTIFIER_SERVICE_ID,
        });
      }
      yield* Effect.annotateCurrentSpan({ "stripe.identity_result": "distinct_id" });
      return personId;
    }

    if (!input.customerId) {
      return yield* new StripePaymentProviderServiceError({
        cause: "Stripe event has neither a stamped distinctId nor a customer id",
      });
    }

    const existing = yield* queries.findExternalIdentifier({
      identifier: input.customerId,
      projectId: input.projectId,
      serviceId: STRIPE_EXTERNAL_IDENTIFIER_SERVICE_ID,
    });
    if (Option.isSome(existing)) {
      yield* Effect.annotateCurrentSpan({
        "stripe.identity_result": "customer_external_identifier",
      });
      return yield* queries.resolveCanonicalPersonId({ personId: existing.value.personId });
    }

    const anonymousDistinctId = buildStripeWebhookAnonymousDistinctId({
      customerId: input.customerId,
      providerEnvironment: input.providerEnvironment,
    });
    const personId = yield* _resolveDistinctIdToPersonId({
      distinctId: anonymousDistinctId,
      eventTimestamp: input.occurredAt,
      origin: PersonOrigin.Stripe,
      projectId: input.projectId,
    });
    yield* queries.createExternalIdentifier({
      id: generateId("personDistinctId"),
      identifier: input.customerId,
      isDefault: true,
      personId,
      projectId: input.projectId,
      serviceId: STRIPE_EXTERNAL_IDENTIFIER_SERVICE_ID,
    });
    yield* Effect.annotateCurrentSpan({ "stripe.identity_result": "webhook_stand_in" });
    return personId;
  });

  /** Resolves the active product mapping or fails with the product-not-mapped error (drives parking). */
  const _resolveProductMapping = Effect.fn("_resolveProductMapping")(function* (input: {
    readonly configurationId: string;
    readonly providerProductKey: string;
  }) {
    const mapping = yield* queries.findActiveProviderProductByPrimaryKey({
      paymentProviderConfigurationId: input.configurationId,
      providerProductKey: input.providerProductKey,
    });
    if (Option.isNone(mapping)) {
      return yield* new StripePaymentProviderProductNotMappedError({
        paymentProviderConfigurationId: input.configurationId,
        providerProductKey: input.providerProductKey,
      });
    }
    yield* Effect.annotateCurrentSpan("voidhash.payment_provider.product_id", mapping.value.id);
    return mapping.value;
  });

  const _buildBase = (input: {
    readonly idempotencyKey: string;
    readonly occurredAt: Date;
    readonly configuration: DbPaymentProviderConfiguration;
    readonly project: DbProject;
    readonly paymentProviderConfigurationProductId: string;
    readonly personId: string;
    readonly providerEnvironment: ProviderEnvironmentValue;
    readonly providerEventType: string;
    readonly providerSubscriptionId: Option.Option<string>;
    readonly providerTransactionId: Option.Option<string>;
    readonly event: StripeEvent;
    readonly receivedAt: Date;
    readonly source: "webhook" | "reconciliation";
  }): PurchaseActionContext => ({
    idempotencyKey: input.idempotencyKey,
    occurredAt: input.occurredAt,
    organizationId: input.project.organizationId,
    paymentProviderConfigurationId: input.configuration.id,
    paymentProviderConfigurationProductId: input.paymentProviderConfigurationProductId,
    personId: input.personId,
    projectId: input.project.id,
    providerEnvironment: input.providerEnvironment,
    providerEventType: input.providerEventType,
    providerId: "stripe" as const,
    providerSubscriptionId: input.providerSubscriptionId,
    providerTransactionId: input.providerTransactionId,
    providerWebhookNotificationId: Option.some(input.event.id),
    rawProviderPayload: Option.some(input.event.data.object),
    receivedAt: input.receivedAt,
    source: input.source,
  });

  /**
   * Builds money for a paid event, fetching the Stripe processing fee (store
   * commission) for net proceeds. Fee fetch is best-effort — proceeds equal
   * gross minus tax when the fee can't be fetched (never guessed).
   */
  const _buildMoneyWithFee = (input: {
    readonly grossMinor: number;
    readonly currency: string;
    readonly taxMinor: number;
    readonly occurredAt: Date;
    readonly chargeId: string | undefined;
    readonly paymentIntentId: string | undefined;
    readonly stripeContext: StripeContext;
    readonly mode: StripeMode;
  }) =>
    Effect.gen(function* () {
      const chargeId =
        input.chargeId ??
        (input.paymentIntentId
          ? yield* input.stripeContext.fetchPaymentIntentLatestChargeId({
              mode: input.mode,
              paymentIntentId: input.paymentIntentId,
            })
          : undefined);
      const feeMinor = chargeId
        ? yield* input.stripeContext.fetchChargeFeeMinor({ chargeId, mode: input.mode })
        : undefined;
      return yield* buildStripeMoney({
        currency: input.currency,
        feeMinor,
        fxRateService,
        grossMinor: input.grossMinor,
        occurredAt: input.occurredAt,
        taxMinor: input.taxMinor,
      });
    });

  // ==================== Record methods ====================

  /** `invoice.paid` — initial subscription invoice (`subscription_create`) or a renewal. */
  const recordInvoicePaid = Effect.fn("recordInvoicePaid")(function* (input: StripeRecordInput) {
    const invoice = yield* decodeStripeObject(StripeInvoiceSchema)(input.event.data.object);
    const providerProductKey = stripeProviderProductKey(invoicePrimaryPriceProduct(invoice) ?? {});
    if (!providerProductKey) {
      return makeIgnored();
    }
    const mapping = yield* _resolveProductMapping({
      configurationId: input.configuration.id,
      providerProductKey,
    });
    const occurredAt = fromUnixSeconds(invoice.created, input.receivedAt);
    const personId = yield* _resolveStripePerson({
      customerId: invoice.customer ?? undefined,
      distinctId: extractStripeDistinctId(invoice),
      occurredAt,
      projectId: input.project.id,
      providerEnvironment: input.providerEnvironment,
    });
    const isCreate = invoice.billing_reason === "subscription_create";
    const eventType: StripePurchaseProcessingEventType = isCreate ? "purchase" : "renewal";
    const idempotencyKey = yield* getStripeIdempotencyKey({
      anchorField: "invoice.id",
      anchorId: invoice.id,
      eventType,
    });
    const grossMinor = invoice.amount_paid ?? invoice.total ?? 0;
    const money = yield* _buildMoneyWithFee({
      chargeId: invoice.charge ?? undefined,
      currency: invoice.currency ?? "",
      grossMinor,
      mode: input.mode,
      occurredAt,
      paymentIntentId: invoice.payment_intent ?? undefined,
      stripeContext: input.stripeContext,
      taxMinor: invoiceTaxMinor(invoice),
    });
    const periodLine = invoice.lines?.data?.find((line) => line.period);
    const startsAt = fromUnixSeconds(periodLine?.period?.start, occurredAt);
    const expiresAt = Option.fromNullishOr(
      typeof periodLine?.period?.end === "number"
        ? new Date(periodLine.period.end * 1000)
        : undefined,
    );
    const isTrial = grossMinor === 0;
    const base = _buildBase({
      configuration: input.configuration,
      event: input.event,
      idempotencyKey,
      occurredAt,
      paymentProviderConfigurationProductId: mapping.id,
      personId,
      project: input.project,
      providerEnvironment: input.providerEnvironment,
      providerEventType: input.event.type,
      providerSubscriptionId: Option.fromNullishOr(invoice.subscription ?? undefined),
      providerTransactionId: Option.fromNullishOr(resolveChargeKey(invoice)),
      receivedAt: input.receivedAt,
      source: input.source,
    });
    if (isCreate) {
      return yield* purchaseProcessingService.startSubscription({
        ...base,
        expiresAt,
        isTrial,
        money,
        purchasedAt: occurredAt,
        startsAt,
      });
    }
    return yield* purchaseProcessingService.renewSubscription({
      ...base,
      expiresAt,
      isTrial,
      money,
      renewedAt: occurredAt,
      startsAt,
    });
  });

  /** `invoice.payment_failed` — the subscription entered Stripe's dunning/retry loop. */
  const recordInvoicePaymentFailed = Effect.fn("recordInvoicePaymentFailed")(function* (
    input: StripeRecordInput,
  ) {
    const invoice = yield* decodeStripeObject(StripeInvoiceSchema)(input.event.data.object);
    const providerProductKey = stripeProviderProductKey(invoicePrimaryPriceProduct(invoice) ?? {});
    if (!providerProductKey) {
      return makeIgnored();
    }
    const mapping = yield* _resolveProductMapping({
      configurationId: input.configuration.id,
      providerProductKey,
    });
    const occurredAt = fromUnixSeconds(invoice.created, input.receivedAt);
    const personId = yield* _resolveStripePerson({
      customerId: invoice.customer ?? undefined,
      distinctId: extractStripeDistinctId(invoice),
      occurredAt,
      projectId: input.project.id,
      providerEnvironment: input.providerEnvironment,
    });
    const idempotencyKey = yield* getStripeIdempotencyKey({
      anchorField: "invoice.id",
      anchorId: invoice.id,
      eventType: "billing_retry",
      extra: [invoice.attempt_count ?? 0],
    });
    const base = _buildBase({
      configuration: input.configuration,
      event: input.event,
      idempotencyKey,
      occurredAt,
      paymentProviderConfigurationProductId: mapping.id,
      personId,
      project: input.project,
      providerEnvironment: input.providerEnvironment,
      providerEventType: input.event.type,
      providerSubscriptionId: Option.fromNullishOr(invoice.subscription ?? undefined),
      providerTransactionId: Option.fromNullishOr(resolveChargeKey(invoice)),
      receivedAt: input.receivedAt,
      source: input.source,
    });
    return yield* purchaseProcessingService.enterBillingRetry({
      ...base,
      billingRetryAt: occurredAt,
      gracePeriodExpiresAt: Option.none(),
    });
  });

  /**
   * `customer.subscription.updated` — acts only on the field that actually
   * changed (read from `previous_attributes`): cancel-at-period-end toggle →
   * cancel / resume; item (plan) change → renewal-preference change. Any other
   * update is ignored.
   */
  const recordSubscriptionUpdated = Effect.fn("recordSubscriptionUpdated")(function* (
    input: StripeRecordInput,
  ) {
    const subscription = yield* decodeStripeObject(StripeSubscriptionSchema)(
      input.event.data.object,
    );
    const previous: StripeSubscriptionPreviousAttributes = input.event.data.previous_attributes
      ? yield* decodeStripeObject(StripeSubscriptionPreviousAttributesSchema)(
          input.event.data.previous_attributes,
        ).pipe(Effect.catch(() => Effect.succeed<StripeSubscriptionPreviousAttributes>({})))
      : {};
    const cancelChanged = typeof previous.cancel_at_period_end === "boolean";
    const itemsChanged = previous.items !== undefined || previous.plan !== undefined;
    if (!cancelChanged && !itemsChanged) {
      return makeIgnored();
    }

    const providerProductKey = stripeProviderProductKey(
      subscriptionPrimaryPriceProduct(subscription) ?? {},
    );
    if (!providerProductKey) {
      return makeIgnored();
    }
    const mapping = yield* _resolveProductMapping({
      configurationId: input.configuration.id,
      providerProductKey,
    });
    const occurredAt = fromUnixSeconds(input.event.created, input.receivedAt);
    const personId = yield* _resolveStripePerson({
      customerId: subscription.customer ?? undefined,
      distinctId: extractStripeDistinctId({ metadata: subscription.metadata }),
      occurredAt,
      projectId: input.project.id,
      providerEnvironment: input.providerEnvironment,
    });
    const periodAnchor = subscription.current_period_end ?? subscription.ended_at ?? 0;
    const buildBaseFor = (eventType: StripePurchaseProcessingEventType, idempotencyKey: string) =>
      _buildBase({
        configuration: input.configuration,
        event: input.event,
        idempotencyKey,
        occurredAt,
        paymentProviderConfigurationProductId: mapping.id,
        personId,
        project: input.project,
        providerEnvironment: input.providerEnvironment,
        providerEventType: `${input.event.type}:${eventType}`,
        providerSubscriptionId: Option.fromNullishOr(subscription.id),
        providerTransactionId: Option.none(),
        receivedAt: input.receivedAt,
        source: input.source,
      });

    if (cancelChanged) {
      if (subscription.cancel_at_period_end === true) {
        // Anchor on `canceled_at` (falling back to the period) so a
        // cancel → resume → cancel toggle within the SAME billing period yields
        // distinct keys rather than deduping the second cancel against the first.
        const idempotencyKey = yield* getStripeIdempotencyKey({
          anchorField: "subscription.id",
          anchorId: subscription.id,
          eventType: "canceled",
          extra: [subscription.canceled_at ?? periodAnchor],
        });
        return yield* purchaseProcessingService.cancelSubscription({
          ...buildBaseFor("canceled", idempotencyKey),
          cancelAtPeriodEnd: true,
          canceledAt: fromUnixSeconds(subscription.canceled_at, occurredAt),
          cancellationReason: Option.none(),
        });
      }
      const idempotencyKey = yield* getStripeIdempotencyKey({
        anchorField: "subscription.id",
        anchorId: subscription.id,
        eventType: "auto_renew_resumed",
        extra: [periodAnchor],
      });
      return yield* purchaseProcessingService.resumeAutoRenew({
        ...buildBaseFor("auto_renew_resumed", idempotencyKey),
        resumedAt: occurredAt,
      });
    }

    const idempotencyKey = yield* getStripeIdempotencyKey({
      anchorField: "subscription.id",
      anchorId: subscription.id,
      eventType: "renewal_pref_change",
      extra: [providerProductKey],
    });
    return yield* purchaseProcessingService.changeRenewalPreference({
      ...buildBaseFor("renewal_pref_change", idempotencyKey),
      newPaymentProviderConfigurationProductId: Option.some(mapping.id),
      newProviderProductKey: providerProductKey,
    });
  });

  /** `customer.subscription.deleted` — the subscription ended. */
  const recordSubscriptionDeleted = Effect.fn("recordSubscriptionDeleted")(function* (
    input: StripeRecordInput,
  ) {
    const subscription = yield* decodeStripeObject(StripeSubscriptionSchema)(
      input.event.data.object,
    );
    const providerProductKey = stripeProviderProductKey(
      subscriptionPrimaryPriceProduct(subscription) ?? {},
    );
    if (!providerProductKey) {
      return makeIgnored();
    }
    const mapping = yield* _resolveProductMapping({
      configurationId: input.configuration.id,
      providerProductKey,
    });
    const occurredAt = fromUnixSeconds(
      subscription.ended_at ?? input.event.created,
      input.receivedAt,
    );
    const personId = yield* _resolveStripePerson({
      customerId: subscription.customer ?? undefined,
      distinctId: extractStripeDistinctId({ metadata: subscription.metadata }),
      occurredAt,
      projectId: input.project.id,
      providerEnvironment: input.providerEnvironment,
    });
    const idempotencyKey = yield* getStripeIdempotencyKey({
      anchorField: "subscription.id",
      anchorId: subscription.id,
      eventType: "expired",
      extra: [subscription.ended_at ?? subscription.current_period_end ?? 0],
    });
    const base = _buildBase({
      configuration: input.configuration,
      event: input.event,
      idempotencyKey,
      occurredAt,
      paymentProviderConfigurationProductId: mapping.id,
      personId,
      project: input.project,
      providerEnvironment: input.providerEnvironment,
      providerEventType: input.event.type,
      providerSubscriptionId: Option.fromNullishOr(subscription.id),
      providerTransactionId: Option.none(),
      receivedAt: input.receivedAt,
      source: input.source,
    });
    return yield* purchaseProcessingService.expireSubscription({ ...base, expiredAt: occurredAt });
  });

  /** `checkout.session.completed` — one-time (non-subscription) payment. Subscription checkouts flow through `invoice.paid`. */
  const recordCheckoutSessionCompleted = Effect.fn("recordCheckoutSessionCompleted")(function* (
    input: StripeRecordInput,
  ) {
    const session = yield* decodeStripeObject(StripeCheckoutSessionSchema)(input.event.data.object);
    if (!isPaidOneTimeCheckout(session) || !session.id) {
      return makeIgnored();
    }
    const lineItem = yield* input.stripeContext.fetchCheckoutLineItemPriceProduct({
      mode: input.mode,
      sessionId: session.id,
    });
    const providerProductKey = stripeProviderProductKey(lineItem ?? {});
    if (!providerProductKey) {
      return makeIgnored();
    }
    const mapping = yield* _resolveProductMapping({
      configurationId: input.configuration.id,
      providerProductKey,
    });
    const occurredAt = fromUnixSeconds(session.created, input.receivedAt);
    const personId = yield* _resolveStripePerson({
      customerId: session.customer ?? undefined,
      distinctId: extractStripeDistinctId(session),
      occurredAt,
      projectId: input.project.id,
      providerEnvironment: input.providerEnvironment,
    });
    const idempotencyKey = yield* getStripeIdempotencyKey({
      anchorField: "payment_intent",
      anchorId: session.payment_intent ?? session.id,
      eventType: "purchase",
    });
    const grossMinor = session.amount_total ?? session.amount_subtotal ?? 0;
    const money = yield* _buildMoneyWithFee({
      chargeId: undefined,
      currency: session.currency ?? "",
      grossMinor,
      mode: input.mode,
      occurredAt,
      paymentIntentId: session.payment_intent ?? undefined,
      stripeContext: input.stripeContext,
      taxMinor: session.total_details?.amount_tax ?? 0,
    });
    const base = _buildBase({
      configuration: input.configuration,
      event: input.event,
      idempotencyKey,
      occurredAt,
      paymentProviderConfigurationProductId: mapping.id,
      personId,
      project: input.project,
      providerEnvironment: input.providerEnvironment,
      providerEventType: input.event.type,
      providerSubscriptionId: Option.none(),
      providerTransactionId: Option.fromNullishOr(session.payment_intent ?? session.id),
      receivedAt: input.receivedAt,
      source: input.source,
    });
    return yield* purchaseProcessingService.completeOneTimePurchase({
      ...base,
      money,
      purchaseType:
        mapping.productType === ProductType.OneTimeConsumable ? "consumable" : "one-time",
      purchasedAt: occurredAt,
    });
  });

  /**
   * Resolves the original transaction (product mapping + owning person + the
   * stored store-transaction id) for a refund/reversal/dispute event. Refund
   * webhooks carry only a charge (no price/product), so the mapping is recovered
   * from the transaction the purchase wrote — matched on ANY of the candidate
   * ids the refund-side object exposes, because the paid-charge identifier lives
   * in different fields (`payment_intent` / `charge` / `invoice`) across Stripe
   * API versions and the original purchase may have keyed the transaction on a
   * different one than the refund object surfaces. Returns `Option.none()` when
   * no transaction matches — nothing to refund.
   */
  const _resolveRefundTarget = Effect.fn("_resolveRefundTarget")(function* (input: {
    readonly candidateKeys: ReadonlyArray<string | null | undefined>;
  }) {
    const candidateKeys = input.candidateKeys.filter(
      (key): key is string => typeof key === "string" && key.length > 0,
    );
    return yield* queries.findTransactionByAnyStoreTransactionId({
      storeTransactionIds: candidateKeys,
    });
  });

  const refundNotFound = (
    eventId: string,
    candidateKeys: ReadonlyArray<string | null | undefined>,
  ) =>
    Effect.logWarning(
      "Stripe refund/dispute: no matching transaction found; refund not applied (untracked charge or out-of-order delivery before the purchase webhook)",
      {
        candidateKeys: candidateKeys.filter((key) => typeof key === "string"),
        eventId,
      },
    ).pipe(Effect.as(makeIgnored()));

  /** `charge.refunded` — a charge was fully refunded. (Partial refunds are not yet reflected.) */
  const recordChargeRefunded = Effect.fn("recordChargeRefunded")(function* (
    input: StripeRecordInput,
  ) {
    const charge = yield* decodeStripeObject(StripeChargeSchema)(input.event.data.object);
    if (charge.refunded !== true) {
      // Partial refund (cumulative `amount_refunded` < amount): not reflected in v1.
      return makeIgnored();
    }
    // A charge can have keyed the original transaction by payment_intent, the
    // charge id itself, or (fallback) the invoice id — try all.
    const candidateKeys = [charge.payment_intent, charge.id, charge.invoice];
    const target = yield* _resolveRefundTarget({ candidateKeys });
    if (Option.isNone(target)) {
      return yield* refundNotFound(input.event.id, candidateKeys);
    }
    const storeTransactionId = target.value.storeTransactionId ?? resolveChargeKey(charge);
    if (!storeTransactionId) {
      return makeIgnored();
    }
    yield* Effect.annotateCurrentSpan("stripe.storefront", chargeStorefront(charge) ?? "");
    const occurredAt = fromUnixSeconds(charge.created, input.receivedAt);
    const idempotencyKey = yield* getStripeIdempotencyKey({
      anchorField: "charge.id",
      anchorId: storeTransactionId,
      eventType: "refund",
    });
    const base = _buildBase({
      configuration: input.configuration,
      event: input.event,
      idempotencyKey,
      occurredAt,
      paymentProviderConfigurationProductId: target.value.paymentProviderConfigurationProductId,
      personId: target.value.personId,
      project: input.project,
      providerEnvironment: input.providerEnvironment,
      providerEventType: input.event.type,
      providerSubscriptionId: Option.none(),
      providerTransactionId: Option.some(storeTransactionId),
      receivedAt: input.receivedAt,
      source: input.source,
    });
    return yield* purchaseProcessingService.refundPurchase({
      ...base,
      refundReason: Option.none(),
      refundedAt: occurredAt,
    });
  });

  /** `charge.refund.updated` — a previously-succeeded refund failed/was canceled (reversal). */
  const recordRefundUpdated = Effect.fn("recordRefundUpdated")(function* (
    input: StripeRecordInput,
  ) {
    const refund = yield* decodeStripeObject(StripeRefundSchema)(input.event.data.object);
    if (refund.status !== "failed" && refund.status !== "canceled") {
      return makeIgnored();
    }
    const candidateKeys = [refund.payment_intent, refund.charge];
    const target = yield* _resolveRefundTarget({ candidateKeys });
    if (Option.isNone(target)) {
      return yield* refundNotFound(input.event.id, candidateKeys);
    }
    const storeTransactionId = target.value.storeTransactionId ?? resolveChargeKey(refund);
    if (!storeTransactionId) {
      return makeIgnored();
    }
    const occurredAt = fromUnixSeconds(refund.created, input.receivedAt);
    const idempotencyKey = yield* getStripeIdempotencyKey({
      anchorField: "refund.id",
      anchorId: refund.id,
      eventType: "refund_reversed",
    });
    const base = _buildBase({
      configuration: input.configuration,
      event: input.event,
      idempotencyKey,
      occurredAt,
      paymentProviderConfigurationProductId: target.value.paymentProviderConfigurationProductId,
      personId: target.value.personId,
      project: input.project,
      providerEnvironment: input.providerEnvironment,
      providerEventType: input.event.type,
      providerSubscriptionId: Option.none(),
      providerTransactionId: Option.some(storeTransactionId),
      receivedAt: input.receivedAt,
      source: input.source,
    });
    return yield* purchaseProcessingService.reverseRefund({ ...base, reversedAt: occurredAt });
  });

  /** `charge.dispute.closed` — a lost chargeback removes the revenue (like a refund). */
  const recordDisputeClosed = Effect.fn("recordDisputeClosed")(function* (
    input: StripeRecordInput,
  ) {
    const dispute = yield* decodeStripeObject(StripeDisputeSchema)(input.event.data.object);
    if (dispute.status !== "lost") {
      // `won` / `warning_closed` leave the revenue intact; nothing to record.
      return makeIgnored();
    }
    const candidateKeys = [dispute.payment_intent, dispute.charge];
    const target = yield* _resolveRefundTarget({ candidateKeys });
    if (Option.isNone(target)) {
      return yield* refundNotFound(input.event.id, candidateKeys);
    }
    const storeTransactionId = target.value.storeTransactionId ?? resolveChargeKey(dispute);
    if (!storeTransactionId) {
      return makeIgnored();
    }
    const occurredAt = fromUnixSeconds(dispute.created, input.receivedAt);
    const idempotencyKey = yield* getStripeIdempotencyKey({
      anchorField: "dispute.id",
      anchorId: dispute.id,
      eventType: "refund",
    });
    const base = _buildBase({
      configuration: input.configuration,
      event: input.event,
      idempotencyKey,
      occurredAt,
      paymentProviderConfigurationProductId: target.value.paymentProviderConfigurationProductId,
      personId: target.value.personId,
      project: input.project,
      providerEnvironment: input.providerEnvironment,
      providerEventType: input.event.type,
      providerSubscriptionId: Option.none(),
      providerTransactionId: Option.some(storeTransactionId),
      receivedAt: input.receivedAt,
      source: input.source,
    });
    return yield* purchaseProcessingService.refundPurchase({
      ...base,
      refundReason: Option.some("chargeback_lost"),
      refundedAt: occurredAt,
    });
  });

  return {
    buildContextFromConfiguration,
    recordChargeRefunded,
    recordCheckoutSessionCompleted,
    recordDisputeClosed,
    recordInvoicePaid,
    recordInvoicePaymentFailed,
    recordRefundUpdated,
    recordSubscriptionDeleted,
    recordSubscriptionUpdated,
  } as const;
});

export type { StripeContext };

export class StripePaymentProvider extends Context.Service<StripePaymentProvider>()(
  "core/StripePaymentProvider",
  { make },
) {
  static readonly layer = Layer.effect(StripePaymentProvider)(StripePaymentProvider.make).pipe(
    Layer.provideMerge(StripePaymentProviderServiceQueries.layer),
  );
}
