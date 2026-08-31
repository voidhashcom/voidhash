/** Purchase-owned contract for server-trusted revenue events. */
import { constant } from "@voidhash/lib/lang";
import { Schema } from "effect";

const SubscriptionTransferModeSchema = Schema.Literals([
  "transfer_to_new_owner",
  "keep_with_previous_owner",
  "transfer_if_no_active_on_target",
]);

export const RevenueAnalyticsEventNameSchema = Schema.Literals([
  "$purchase.completed",
  "$purchase.refunded",
  "$purchase.revoked",
  "$purchase.transferred_out",
  "$purchase.transferred_in",
  "$subscription.created",
  "$subscription.renewed",
  "$subscription.canceled",
  "$subscription.expired",
  "$subscription.refund_reversed",
  "$subscription.billing_retry",
  "$subscription.extended",
  "$subscription.product_changed",
  "$subscription.offer_redeemed",
  "$subscription.price_increase_pending",
  "$subscription.auto_renew_resumed",
  "$subscription.transferred_out",
  "$subscription.transferred_in",
]);

/**
 * Server-emitted analytics event names are prefixed with `$` (mirroring the
 * PostHog convention for auto-captured / reserved system events) so they can
 * never collide with the customer's own event names sent via the SDK.
 */
export const RESERVED_REVENUE_EVENT_NAMES: ReadonlySet<
  typeof RevenueAnalyticsEventNameSchema.Type
> = new Set<typeof RevenueAnalyticsEventNameSchema.Type>([
  "$purchase.completed",
  "$purchase.refunded",
  "$purchase.revoked",
  "$purchase.transferred_out",
  "$purchase.transferred_in",
  "$subscription.created",
  "$subscription.renewed",
  "$subscription.canceled",
  "$subscription.expired",
  "$subscription.refund_reversed",
  "$subscription.billing_retry",
  "$subscription.extended",
  "$subscription.product_changed",
  "$subscription.offer_redeemed",
  "$subscription.price_increase_pending",
  "$subscription.auto_renew_resumed",
  "$subscription.transferred_out",
  "$subscription.transferred_in",
]);

/**
 * Revenue events whose money fields represent realized signed deltas. Lifecycle
 * events such as `$subscription.created` may carry pricing data for MRR, but
 * must not be summed into realized revenue alongside `$purchase.completed`.
 */
export const REVENUE_MONEY_EVENT_NAMES: ReadonlySet<typeof RevenueAnalyticsEventNameSchema.Type> =
  new Set<typeof RevenueAnalyticsEventNameSchema.Type>([
    "$purchase.completed",
    "$purchase.refunded",
    "$purchase.revoked",
    "$subscription.renewed",
    "$subscription.canceled",
    "$subscription.refund_reversed",
  ]);

const revenueMoneyEventNames: ReadonlySet<string> = REVENUE_MONEY_EVENT_NAMES;

/** Narrows arbitrary event names to the realized-money revenue subset. */
export const isRevenueMoneyEventName = (
  name: string,
): name is typeof RevenueAnalyticsEventNameSchema.Type => revenueMoneyEventNames.has(name);

/** Widened view of {@link RESERVED_REVENUE_EVENT_NAMES} for arbitrary-string membership checks. */
const reservedRevenueEventNames: ReadonlySet<string> = RESERVED_REVENUE_EVENT_NAMES;

/** Narrows arbitrary event names to the complete reserved revenue-event set. */
export const isReservedRevenueEventName = (
  name: string,
): name is typeof RevenueAnalyticsEventNameSchema.Type => reservedRevenueEventNames.has(name);

/**
 * The `sourceTopic` value stamped onto every server-emitted revenue
 * event. The processor's trust check uses this to distinguish trusted revenue
 * events from any reserved-named event that somehow reached the capture
 * pipeline.
 */
export const REVENUE_TRUSTED_SOURCE_TOPIC = constant("revenue.trusted.v1");

const baseEventFields = {
  context: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  distinctId: Schema.String,
  eventId: Schema.String,
  occurredAt: Schema.Date,
  organizationId: Schema.String,
  personId: Schema.String,
  projectId: Schema.String,
  token: Schema.String,
  transactionId: Schema.NullOr(Schema.String),
};

const revenuePropertiesBase = {
  paymentProviderConfigurationId: Schema.String,
  paymentProviderConfigurationProductId: Schema.String,
  productId: Schema.String,
  providerProductKey: Schema.String,
  providerEnvironment: Schema.Number,
  providerEventType: Schema.String,
  providerId: Schema.String,
  providerSubscriptionId: Schema.NullOr(Schema.String),
  providerTransactionId: Schema.NullOr(Schema.String),
  providerWebhookNotificationId: Schema.NullOr(Schema.String),
  source: Schema.String,
};

/**
 * Money-bearing properties shared by revenue event variants. Amounts on
 * `REVENUE_MONEY_EVENT_NAMES` are SIGNED deltas in the unified reporting
 * currency (USD) minor units, so `SUM(grossAmountUsd)` over that set equals
 * revenue without per-event-type branching downstream:
 *   + on `$purchase.completed`, `$subscription.created`,
 *     `$subscription.renewed`, `$subscription.refund_reversed`
 *   − on `$purchase.refunded`, `$purchase.revoked`, and on
 *     `$subscription.canceled` rows that came from a family-revoke (negative
 *     delta on the gross to undo the prior entitlement).
 *
 * Original-currency amounts and the storefront ride along for analytics
 * breakdowns. `currency` is the ISO 4217 code of the original transaction.
 * `amount` / `amountUsd` are kept for downstream readers that haven't
 * migrated to the breakdown columns yet; they mirror `grossAmount` /
 * `grossAmountUsd` and will be removed once those readers are cut over.
 */
const moneyPropertiesFields = {
  amount: Schema.optional(Schema.NullOr(Schema.Number)),
  amountUsd: Schema.optional(Schema.NullOr(Schema.Number)),
  currency: Schema.optional(Schema.String),
  storefront: Schema.optional(Schema.NullOr(Schema.String)),
  grossAmount: Schema.optional(Schema.NullOr(Schema.Number)),
  storeCommissionAmount: Schema.optional(Schema.NullOr(Schema.Number)),
  taxAmount: Schema.optional(Schema.NullOr(Schema.Number)),
  proceedsAmount: Schema.optional(Schema.NullOr(Schema.Number)),
  proceedsAfterTaxAmount: Schema.optional(Schema.NullOr(Schema.Number)),
  grossAmountUsd: Schema.optional(Schema.NullOr(Schema.Number)),
  storeCommissionAmountUsd: Schema.optional(Schema.NullOr(Schema.Number)),
  taxAmountUsd: Schema.optional(Schema.NullOr(Schema.Number)),
  proceedsAmountUsd: Schema.optional(Schema.NullOr(Schema.Number)),
  proceedsAfterTaxAmountUsd: Schema.optional(Schema.NullOr(Schema.Number)),
  exchangeRate: Schema.optional(Schema.NullOr(Schema.Number)),
};

export const RevenuePurchaseCompletedSchema = Schema.Struct({
  ...baseEventFields,
  eventName: Schema.Literal("$purchase.completed"),
  properties: Schema.Struct({
    ...revenuePropertiesBase,
    ...moneyPropertiesFields,
    isTrial: Schema.optional(Schema.Boolean),
    purchaseType: Schema.optional(Schema.Literals(["one-time", "consumable"])),
  }),
});

/**
 * Refunds carry the same money breakdown as the originating purchase, but
 * with each amount negated. Summing `grossAmountUsd` across `$purchase.*`
 * events therefore yields net revenue without per-event-type branching.
 */
export const RevenuePurchaseRefundedSchema = Schema.Struct({
  ...baseEventFields,
  eventName: Schema.Literal("$purchase.refunded"),
  properties: Schema.Struct({
    ...revenuePropertiesBase,
    ...moneyPropertiesFields,
    refundReason: Schema.NullOr(Schema.String),
  }),
});

/**
 * Non-subscription entitlement revocations carry the same money breakdown as
 * the originating purchase, but with each amount negated. Unlike a refund,
 * this represents access loss rather than money returned to the purchaser.
 */
export const RevenuePurchaseRevokedSchema = Schema.Struct({
  ...baseEventFields,
  eventName: Schema.Literal("$purchase.revoked"),
  properties: Schema.Struct({
    ...revenuePropertiesBase,
    ...moneyPropertiesFields,
    revocationReason: Schema.NullOr(Schema.String),
  }),
});

export const RevenueSubscriptionCreatedSchema = Schema.Struct({
  ...baseEventFields,
  eventName: Schema.Literal("$subscription.created"),
  properties: Schema.Struct({
    ...revenuePropertiesBase,
    ...moneyPropertiesFields,
    isTrial: Schema.Boolean,
  }),
});

export const RevenueSubscriptionRenewedSchema = Schema.Struct({
  ...baseEventFields,
  eventName: Schema.Literal("$subscription.renewed"),
  properties: Schema.Struct({
    ...revenuePropertiesBase,
    ...moneyPropertiesFields,
    isTrial: Schema.Boolean,
  }),
});

/**
 * `$subscription.canceled` covers both user-initiated cancellations and
 * provider revocations. User cancels never carry money — Apple keeps the
 * customer entitled until the period ends and we ride the existing
 * `$purchase.completed` revenue through. Family-share revocations DO carry
 * a signed-negative gross delta (no commission / tax, since family-shared
 * transactions don't earn revenue) so the gross-entitlement sum reflects
 * the loss of the granted entitlement.
 */
export const RevenueSubscriptionCanceledSchema = Schema.Struct({
  ...baseEventFields,
  eventName: Schema.Literal("$subscription.canceled"),
  properties: Schema.Struct({
    ...revenuePropertiesBase,
    ...moneyPropertiesFields,
    cancelAtPeriodEnd: Schema.optional(Schema.Boolean),
    cancellationReason: Schema.optional(Schema.NullOr(Schema.String)),
    revocationReason: Schema.optional(Schema.NullOr(Schema.String)),
  }),
});

export const RevenueSubscriptionExpiredSchema = Schema.Struct({
  ...baseEventFields,
  eventName: Schema.Literal("$subscription.expired"),
  properties: Schema.Struct({ ...revenuePropertiesBase }),
});

/**
 * Emitted when the provider reverses a prior refund (Apple's `REFUND_REVERSED`
 * notification). The reversed transaction's entitlement is re-granted in the
 * operational projection; this event signals the same to analytics by
 * emitting the original purchase's money breakdown with the positive sign
 * (mirror of the negative emission from `$purchase.refunded`).
 */
export const RevenueSubscriptionRefundReversedSchema = Schema.Struct({
  ...baseEventFields,
  eventName: Schema.Literal("$subscription.refund_reversed"),
  properties: Schema.Struct({
    ...revenuePropertiesBase,
    ...moneyPropertiesFields,
  }),
});

/** `DID_FAIL_TO_RENEW` — subscription entered the billing-retry loop. */
export const RevenueSubscriptionBillingRetrySchema = Schema.Struct({
  ...baseEventFields,
  eventName: Schema.Literal("$subscription.billing_retry"),
  properties: Schema.Struct({
    ...revenuePropertiesBase,
    gracePeriodExpiresAt: Schema.NullOr(Schema.Date),
  }),
});

/** `RENEWAL_EXTENDED` / `RENEWAL_EXTENSION` — service-issued period extension. */
export const RevenueSubscriptionExtendedSchema = Schema.Struct({
  ...baseEventFields,
  eventName: Schema.Literal("$subscription.extended"),
  properties: Schema.Struct({
    ...revenuePropertiesBase,
    extendedTo: Schema.Date,
  }),
});

/**
 * `DID_CHANGE_RENEWAL_PREF` — customer selected a different product for the
 * next renewal. Apple's semantics: takes effect at next billing cycle, NOT
 * immediately. The current subscription stays on the existing product mapping.
 */
export const RevenueSubscriptionProductChangedSchema = Schema.Struct({
  ...baseEventFields,
  eventName: Schema.Literal("$subscription.product_changed"),
  properties: Schema.Struct({
    ...revenuePropertiesBase,
    newProviderProductKey: Schema.String,
  }),
});

/** `OFFER_REDEEMED` — promotional / introductory / win-back offer applied. */
export const RevenueSubscriptionOfferRedeemedSchema = Schema.Struct({
  ...baseEventFields,
  eventName: Schema.Literal("$subscription.offer_redeemed"),
  properties: Schema.Struct({
    ...revenuePropertiesBase,
    offerId: Schema.NullOr(Schema.String),
  }),
});

/** `PRICE_INCREASE` — Apple has scheduled a price change for the next renewal. */
export const RevenueSubscriptionPriceIncreasePendingSchema = Schema.Struct({
  ...baseEventFields,
  eventName: Schema.Literal("$subscription.price_increase_pending"),
  properties: Schema.Struct({
    ...revenuePropertiesBase,
    ...moneyPropertiesFields,
    effectiveAt: Schema.NullOr(Schema.Date),
  }),
});

/** `DID_CHANGE_RENEWAL_STATUS=AUTO_RENEW_ENABLED` — customer un-canceled. */
export const RevenueSubscriptionAutoRenewResumedSchema = Schema.Struct({
  ...baseEventFields,
  eventName: Schema.Literal("$subscription.auto_renew_resumed"),
  properties: Schema.Struct({ ...revenuePropertiesBase }),
});

/**
 * Shared `properties` for the four cross-owner transfer events. The same
 * `properties` payload is emitted on both halves of a transfer pair
 * (`transferred_out` on the source person, `transferred_in` on the target) so
 * a downstream consumer can correlate the two; what differs is the per-event
 * identity (`distinctId` / `personId` from {@link baseEventFields}).
 *
 * `subscriptionId` / `storeSubscriptionId` are populated on the
 * `$subscription.*` variants; `purchaseId` / `providerKey` on the
 * `$purchase.*` variants.
 */
const transferPropertiesBase = {
  paymentProviderConfigurationId: Schema.String,
  paymentProviderConfigurationProductId: Schema.String,
  productId: Schema.String,
  providerProductKey: Schema.String,
  providerId: Schema.String,
  providerEnvironment: Schema.Number,
  source: Schema.String,
  providerEventType: Schema.String,
  subscriptionId: Schema.optional(Schema.String),
  purchaseId: Schema.optional(Schema.String),
  storeSubscriptionId: Schema.optional(Schema.NullOr(Schema.String)),
  providerKey: Schema.optional(Schema.NullOr(Schema.String)),
  fromDistinctId: Schema.String,
  fromPersonId: Schema.String,
  toDistinctId: Schema.String,
  toPersonId: Schema.String,
  transferMode: SubscriptionTransferModeSchema,
  transferReason: Schema.String,
  transferredAt: Schema.Date,
};

/**
 * Emitted on the SOURCE person when a subscription's ownership is transferred
 * away — e.g. a different identified user restored it on a shared device.
 */
export const RevenueSubscriptionTransferredOutSchema = Schema.Struct({
  ...baseEventFields,
  eventName: Schema.Literal("$subscription.transferred_out"),
  properties: Schema.Struct({ ...transferPropertiesBase }),
});

/** Emitted on the TARGET person — the mirror of `$subscription.transferred_out`. */
export const RevenueSubscriptionTransferredInSchema = Schema.Struct({
  ...baseEventFields,
  eventName: Schema.Literal("$subscription.transferred_in"),
  properties: Schema.Struct({ ...transferPropertiesBase }),
});

/** `$subscription.transferred_out` analogue for non-consumable one-time purchases. */
export const RevenuePurchaseTransferredOutSchema = Schema.Struct({
  ...baseEventFields,
  eventName: Schema.Literal("$purchase.transferred_out"),
  properties: Schema.Struct({ ...transferPropertiesBase }),
});

/** Emitted on the TARGET person — the mirror of `$purchase.transferred_out`. */
export const RevenuePurchaseTransferredInSchema = Schema.Struct({
  ...baseEventFields,
  eventName: Schema.Literal("$purchase.transferred_in"),
  properties: Schema.Struct({ ...transferPropertiesBase }),
});

/** All server-trusted revenue event variants accepted by the purchase outbox. */
export const RevenueEventSchema = Schema.Union([
  RevenuePurchaseCompletedSchema,
  RevenuePurchaseRefundedSchema,
  RevenuePurchaseRevokedSchema,
  RevenueSubscriptionCreatedSchema,
  RevenueSubscriptionRenewedSchema,
  RevenueSubscriptionCanceledSchema,
  RevenueSubscriptionExpiredSchema,
  RevenueSubscriptionRefundReversedSchema,
  RevenueSubscriptionBillingRetrySchema,
  RevenueSubscriptionExtendedSchema,
  RevenueSubscriptionProductChangedSchema,
  RevenueSubscriptionOfferRedeemedSchema,
  RevenueSubscriptionPriceIncreasePendingSchema,
  RevenueSubscriptionAutoRenewResumedSchema,
  RevenueSubscriptionTransferredOutSchema,
  RevenueSubscriptionTransferredInSchema,
  RevenuePurchaseTransferredOutSchema,
  RevenuePurchaseTransferredInSchema,
]);

export type RevenueEvent = typeof RevenueEventSchema.Type;
