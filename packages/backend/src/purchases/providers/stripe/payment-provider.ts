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
 *  - Partial refunds (`charge.refunded` with `refunded === false`) emit an
 *    analytics-only refund event carrying the newly-refunded delta; the
 *    entitlement/projection rows are only flipped by a FULL refund. The
 *    delta's tax/fee split is unknown from the event, so it is reported as
 *    gross with proceeds = gross.
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
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { HttpClient } from "effect/unstable/http/HttpClient";

import { constant } from "@voidhash/lib/lang";

import { PurchaseProcessingResult } from "@voidhash/core-v2";
import {
  FxRates as FxRateService,
  type PurchaseActionContext,
  PurchaseProcessor,
} from "@voidhash/core-v2";
import { PersonIdentityService } from "@voidhash/core/services/personIdentity/PersonIdentityService";
import { PaymentConfigSecretCrypto } from "@voidhash/core/utils/crypto/PaymentConfigSecretCrypto";
import { generateId } from "@voidhash/core/utils";
import { globalConfiguration as globalConfigurationSchema } from "./config-provider.ts";
import {
  StripePaymentProviderProductNotMappedError,
  StripePaymentProviderTransactionNotFoundError,
  StripePaymentProviderServiceError,
} from "./errors.ts";
import {
  decodeStripeObject,
  StripeCharge,
  StripeCheckoutSession,
  type StripeEvent,
  StripeInvoice,
  StripeRefund,
  StripeDispute,
  StripeSubscriptionPreviousAttributes,
  StripeSubscription,
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
import { buildStripeMoney } from "@voidhash/core-v2";
import { StripePaymentProviderServiceQueries } from "./payment-provider-service-queries.ts";
import { buildStripeContext, type StripeContext, type StripeMode } from "./sdk-context.ts";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import { recoverAll } from "../../../runtime-boundary.ts";

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
  readonly event: typeof StripeEvent.Type;
  readonly mode: StripeMode;
  readonly stripeContext: StripeContext;
  readonly providerEnvironment: ProviderEnvironmentValue;
  readonly receivedAt: Date;
  readonly source: "webhook" | "reconciliation";
}

const fromUnixSeconds = (
  seconds: number | typeof Schema.Null.Type | typeof Schema.Undefined.Type,
  fallback: Date,
): Date => {
  if (P.isNumber(seconds)) return dateFromUnixSeconds(seconds);
  return fallback;
};

const invoiceEventType = (isCreate: boolean): StripePurchaseProcessingEventType => {
  if (isCreate) return "purchase";
  return "renewal";
};

const purchaseTypeForProduct = (
  productType: number | typeof Schema.Undefined.Type,
): "consumable" | "one-time" => {
  if (productType === ProductType.OneTimeConsumable) return "consumable";
  return "one-time";
};

const dateFromUnixSeconds = (seconds: number): Date =>
  DateTime.toDateUtc(DateTime.makeUnsafe(seconds * 1000));

const optionalDateFromUnixSeconds = (
  seconds: number | typeof Schema.Null.Type | typeof Schema.Undefined.Type,
): Date | typeof Schema.Undefined.Type => {
  if (P.isNumber(seconds)) return dateFromUnixSeconds(seconds);
  return undefined;
};

/**
 * Loose view of `data.previous_attributes` on a `charge.refunded` event.
 * `amount_refunded` (when present) is the cumulative refunded amount BEFORE
 * this event, which lets the handler derive the newly-refunded delta
 * statelessly.
 */
const decodePartialRefundPreviousAttributes = Schema.decodeUnknownOption(
  Schema.Struct({
    amount_refunded: Schema.optional(Schema.NullOr(Schema.Number)),
  }),
);

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

const make = Effect.fn("make")(function* () {
  const queries = yield* StripePaymentProviderServiceQueries;
  const personIdentityService = yield* PersonIdentityService;
  const purchaseProcessingService = yield* PurchaseProcessor;
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
    const [liveSecretKey, liveWebhookSecret, testSecretKey, testWebhookSecret] = yield* Effect.all(
      [
        secretCrypto.decrypt(parsed.live.secretKey),
        secretCrypto.decrypt(parsed.live.webhookSecret),
        secretCrypto.decrypt(parsed.test.secretKey),
        secretCrypto.decrypt(parsed.test.webhookSecret),
      ],
      { concurrency: 1 },
    );
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
    readonly distinctId: string | typeof Schema.Undefined.Type;
    readonly customerId: string | typeof Schema.Undefined.Type;
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
    readonly event: typeof StripeEvent.Type;
    readonly receivedAt: Date;
    readonly source: "webhook" | "reconciliation";
  }): typeof PurchaseActionContext.Type => ({
    idempotencyKey: input.idempotencyKey,
    occurredAt: input.occurredAt,
    organizationId: input.project.organizationId,
    paymentProviderConfigurationId: input.configuration.id,
    paymentProviderConfigurationProductId: input.paymentProviderConfigurationProductId,
    personId: input.personId,
    projectId: input.project.id,
    providerEnvironment: input.providerEnvironment,
    providerEventType: input.providerEventType,
    providerId: constant("stripe"),
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
    readonly chargeId: string | typeof Schema.Undefined.Type;
    readonly paymentIntentId: string | typeof Schema.Undefined.Type;
    readonly stripeContext: StripeContext;
    readonly mode: StripeMode;
  }) =>
    Effect.fn("_buildMoneyWithFee")(function* () {
      const chargeId =
        input.chargeId ??
        (yield* Effect.fn("chargeId")(function* () {
          if (!input.paymentIntentId) return undefined;
          return yield* input.stripeContext.fetchPaymentIntentLatestChargeId({
            mode: input.mode,
            paymentIntentId: input.paymentIntentId,
          });
        })());
      const feeMinor = yield* Effect.fn("feeMinor")(function* () {
        if (!chargeId) return undefined;
        return yield* input.stripeContext.fetchChargeFeeMinor({ chargeId, mode: input.mode });
      })();
      return yield* buildStripeMoney({
        currency: input.currency,
        feeMinor,
        fxRateService,
        grossMinor: input.grossMinor,
        occurredAt: input.occurredAt,
        taxMinor: input.taxMinor,
      });
    })();

  // ==================== Record methods ====================

  /** `invoice.paid` — initial subscription invoice (`subscription_create`) or a renewal. */
  const recordInvoicePaid = Effect.fn("recordInvoicePaid")(function* (input: StripeRecordInput) {
    const invoice = yield* decodeStripeObject(StripeInvoice)(input.event.data.object);
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
    const eventType: StripePurchaseProcessingEventType = invoiceEventType(isCreate);
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
    const expiresAt = Option.fromNullishOr(optionalDateFromUnixSeconds(periodLine?.period?.end));
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
    const invoice = yield* decodeStripeObject(StripeInvoice)(input.event.data.object);
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
    const subscription = yield* decodeStripeObject(StripeSubscription)(input.event.data.object);
    const previousAttributes = input.event.data.previous_attributes;
    const previous: typeof StripeSubscriptionPreviousAttributes.Type = yield* Effect.fn("previous")(
      function* () {
        if (!previousAttributes) return {};
        return yield* decodeStripeObject(StripeSubscriptionPreviousAttributes)(
          previousAttributes,
        ).pipe(recoverAll((): typeof StripeSubscriptionPreviousAttributes.Type => ({})));
      },
    )();
    const cancelChanged = P.isBoolean(previous.cancel_at_period_end);
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
    const subscription = yield* decodeStripeObject(StripeSubscription)(input.event.data.object);
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
    const session = yield* decodeStripeObject(StripeCheckoutSession)(input.event.data.object);
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
      purchaseType: purchaseTypeForProduct(mapping.productType),
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
    readonly candidateKeys: ReadonlyArray<
      string | typeof Schema.Null.Type | typeof Schema.Undefined.Type
    >;
  }) {
    const candidateKeys = input.candidateKeys.filter(
      (key): key is string => P.isString(key) && Str.isNonEmpty(key),
    );
    return yield* queries.findTransactionByAnyStoreTransactionId({
      storeTransactionIds: candidateKeys,
    });
  });

  const refundNotFound = (
    eventId: string,
    candidateKeys: ReadonlyArray<string | typeof Schema.Null.Type | typeof Schema.Undefined.Type>,
  ) =>
    Effect.fail(
      new StripePaymentProviderTransactionNotFoundError({
        candidateKeys: candidateKeys.filter(
          (key): key is string => P.isString(key) && Str.isNonEmpty(key),
        ),
        eventId,
      }),
    );

  /**
   * `charge.refunded` with `refunded === false` — a partial refund. Emits a
   * refund event carrying only the newly-refunded delta (derived from
   * `previous_attributes.amount_refunded`, so redeliveries of the same
   * cumulative state are no-ops); the entitlement and projection rows stay
   * untouched. Tax/fee split of the refunded slice is unknown from the event,
   * so the delta is reported as gross with proceeds = gross.
   */
  const recordPartialChargeRefund = Effect.fn("recordPartialChargeRefund")(function* (
    input: StripeRecordInput,
    charge: typeof StripeCharge.Type,
  ) {
    const amountRefunded = charge.amount_refunded ?? 0;
    const previousRefunded = Option.match(
      decodePartialRefundPreviousAttributes(input.event.data.previous_attributes ?? {}),
      {
        onNone: () => 0,
        onSome: (attributes) => attributes.amount_refunded ?? 0,
      },
    );
    const refundedDelta = amountRefunded - previousRefunded;
    if (refundedDelta <= 0 || !charge.currency) {
      return makeIgnored();
    }
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
    const money = yield* buildStripeMoney({
      currency: charge.currency,
      feeMinor: undefined,
      fxRateService,
      grossMinor: refundedDelta,
      occurredAt,
      taxMinor: 0,
    });
    if (Option.isNone(money)) {
      yield* Effect.logWarning(
        `recordPartialChargeRefund: unparseable currency ${charge.currency}; partial refund not recorded (eventId=${input.event.id})`,
      );
      return makeIgnored();
    }
    // Suffixed with the cumulative refunded amount so each further partial
    // refund of the same charge gets a fresh key while a redelivered event
    // for the same state dedupes.
    const idempotencyKey = yield* getStripeIdempotencyKey({
      anchorField: "charge.id",
      anchorId: storeTransactionId,
      eventType: "partial_refund",
      extra: [amountRefunded],
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
      partialRefundMoney: money.value,
      refundReason: Option.some("partial_refund"),
      refundedAt: occurredAt,
    });
  });

  /** `charge.refunded` — a charge was fully refunded; partials route to {@link recordPartialChargeRefund}. */
  const recordChargeRefunded = Effect.fn("recordChargeRefunded")(function* (
    input: StripeRecordInput,
  ) {
    const charge = yield* decodeStripeObject(StripeCharge)(input.event.data.object);
    if (charge.refunded !== true) {
      return yield* recordPartialChargeRefund(input, charge);
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
    const refund = yield* decodeStripeObject(StripeRefund)(input.event.data.object);
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
    const dispute = yield* decodeStripeObject(StripeDispute)(input.event.data.object);
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
    // Anchored on the store transaction id — the exact key `charge.refunded`
    // derives — so a charge that is both fully refunded and lost at dispute
    // books a single full refund whichever event arrives first.
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
      refundReason: Option.some("chargeback_lost"),
      refundedAt: occurredAt,
    });
  });

  return constant({
    buildContextFromConfiguration,
    recordChargeRefunded,
    recordCheckoutSessionCompleted,
    recordDisputeClosed,
    recordInvoicePaid,
    recordInvoicePaymentFailed,
    recordRefundUpdated,
    recordSubscriptionDeleted,
    recordSubscriptionUpdated,
  });
})();

export type { StripeContext };

export class StripePaymentProvider extends Context.Service<StripePaymentProvider>()(
  "@voidhash/backend/purchases/StripePaymentProvider",
  { make },
) {
  static readonly layer = Layer.effect(StripePaymentProvider)(StripePaymentProvider.make).pipe(
    Layer.provideMerge(StripePaymentProviderServiceQueries.layer),
  );
}
