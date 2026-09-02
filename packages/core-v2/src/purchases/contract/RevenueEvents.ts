/** Purchase-owned contract for server-trusted revenue events. */
import { constant } from "@voidhash/lib/lang";
import * as HashSet from "effect/HashSet";
import * as Schema from "effect/Schema";

const SubscriptionTransferMode = Schema.Literals([
  "transfer_to_new_owner",
  "keep_with_previous_owner",
  "transfer_if_no_active_on_target",
]);

export const RevenueAnalyticsEventName = Schema.Literals([
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
export type RevenueAnalyticsEventName = typeof RevenueAnalyticsEventName.Type;

/**
 * Server-emitted analytics event names are prefixed with `$` (mirroring the
 * PostHog convention for auto-captured / reserved system events) so they can
 * never collide with the customer's own event names sent via the SDK.
 */
export const RESERVED_REVENUE_EVENT_NAMES: HashSet.HashSet<typeof RevenueAnalyticsEventName.Type> =
  HashSet.fromIterable(RevenueAnalyticsEventName.literals);

/**
 * Revenue events whose money fields represent realized signed deltas. Lifecycle
 * events such as `$subscription.created` may carry pricing data for MRR, but
 * must not be summed into realized revenue alongside `$purchase.completed`.
 */
export const REVENUE_MONEY_EVENT_NAME_LIST: ReadonlyArray<typeof RevenueAnalyticsEventName.Type> = [
  "$purchase.completed",
  "$purchase.refunded",
  "$purchase.revoked",
  "$subscription.renewed",
  "$subscription.canceled",
  "$subscription.refund_reversed",
];

export const REVENUE_MONEY_EVENT_NAMES: HashSet.HashSet<typeof RevenueAnalyticsEventName.Type> =
  HashSet.fromIterable(REVENUE_MONEY_EVENT_NAME_LIST);

const revenueMoneyEventNames: HashSet.HashSet<string> = REVENUE_MONEY_EVENT_NAMES;

/** Narrows arbitrary event names to the realized-money revenue subset. */
export const isRevenueMoneyEventName = (
  name: string,
): name is typeof RevenueAnalyticsEventName.Type => HashSet.has(revenueMoneyEventNames, name);

/** Widened view of {@link RESERVED_REVENUE_EVENT_NAMES} for arbitrary-string membership checks. */
const reservedRevenueEventNames: HashSet.HashSet<string> = RESERVED_REVENUE_EVENT_NAMES;

/** Narrows arbitrary event names to the complete reserved revenue-event set. */
export const isReservedRevenueEventName = (
  name: string,
): name is typeof RevenueAnalyticsEventName.Type => HashSet.has(reservedRevenueEventNames, name);

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

export const RevenuePurchaseCompleted = Schema.Struct({
  ...baseEventFields,
  eventName: Schema.Literal("$purchase.completed"),
  properties: Schema.Struct({
    ...revenuePropertiesBase,
    ...moneyPropertiesFields,
    isTrial: Schema.optional(Schema.Boolean),
    purchaseType: Schema.optional(Schema.Literals(["one-time", "consumable"])),
  }),
});
export type RevenuePurchaseCompleted = typeof RevenuePurchaseCompleted.Type;

/**
 * Refunds carry the same money breakdown as the originating purchase, but
 * with each amount negated. Summing `grossAmountUsd` across `$purchase.*`
 * events therefore yields net revenue without per-event-type branching.
 */
export const RevenuePurchaseRefunded = Schema.Struct({
  ...baseEventFields,
  eventName: Schema.Literal("$purchase.refunded"),
  properties: Schema.Struct({
    ...revenuePropertiesBase,
    ...moneyPropertiesFields,
    refundReason: Schema.NullOr(Schema.String),
  }),
});
export type RevenuePurchaseRefunded = typeof RevenuePurchaseRefunded.Type;

/**
 * Non-subscription entitlement revocations carry the same money breakdown as
 * the originating purchase, but with each amount negated. Unlike a refund,
 * this represents access loss rather than money returned to the purchaser.
 */
export const RevenuePurchaseRevoked = Schema.Struct({
  ...baseEventFields,
  eventName: Schema.Literal("$purchase.revoked"),
  properties: Schema.Struct({
    ...revenuePropertiesBase,
    ...moneyPropertiesFields,
    revocationReason: Schema.NullOr(Schema.String),
  }),
});
export type RevenuePurchaseRevoked = typeof RevenuePurchaseRevoked.Type;

export const RevenueSubscriptionCreated = Schema.Struct({
  ...baseEventFields,
  eventName: Schema.Literal("$subscription.created"),
  properties: Schema.Struct({
    ...revenuePropertiesBase,
    ...moneyPropertiesFields,
    isTrial: Schema.Boolean,
  }),
});
export type RevenueSubscriptionCreated = typeof RevenueSubscriptionCreated.Type;

export const RevenueSubscriptionRenewed = Schema.Struct({
  ...baseEventFields,
  eventName: Schema.Literal("$subscription.renewed"),
  properties: Schema.Struct({
    ...revenuePropertiesBase,
    ...moneyPropertiesFields,
    isTrial: Schema.Boolean,
  }),
});
export type RevenueSubscriptionRenewed = typeof RevenueSubscriptionRenewed.Type;

/**
 * `$subscription.canceled` covers both user-initiated cancellations and
 * provider revocations. User cancels never carry money — Apple keeps the
 * customer entitled until the period ends and we ride the existing
 * `$purchase.completed` revenue through. Family-share revocations DO carry
 * a signed-negative gross delta (no commission / tax, since family-shared
 * transactions don't earn revenue) so the gross-entitlement sum reflects
 * the loss of the granted entitlement.
 */
export const RevenueSubscriptionCanceled = Schema.Struct({
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
export type RevenueSubscriptionCanceled = typeof RevenueSubscriptionCanceled.Type;

export const RevenueSubscriptionExpired = Schema.Struct({
  ...baseEventFields,
  eventName: Schema.Literal("$subscription.expired"),
  properties: Schema.Struct({ ...revenuePropertiesBase }),
});
export type RevenueSubscriptionExpired = typeof RevenueSubscriptionExpired.Type;

/**
 * Emitted when the provider reverses a prior refund (Apple's `REFUND_REVERSED`
 * notification). The reversed transaction's entitlement is re-granted in the
 * operational projection; this event signals the same to analytics by
 * emitting the original purchase's money breakdown with the positive sign
 * (mirror of the negative emission from `$purchase.refunded`).
 */
export const RevenueSubscriptionRefundReversed = Schema.Struct({
  ...baseEventFields,
  eventName: Schema.Literal("$subscription.refund_reversed"),
  properties: Schema.Struct({
    ...revenuePropertiesBase,
    ...moneyPropertiesFields,
  }),
});
export type RevenueSubscriptionRefundReversed = typeof RevenueSubscriptionRefundReversed.Type;

/** `DID_FAIL_TO_RENEW` — subscription entered the billing-retry loop. */
export const RevenueSubscriptionBillingRetry = Schema.Struct({
  ...baseEventFields,
  eventName: Schema.Literal("$subscription.billing_retry"),
  properties: Schema.Struct({
    ...revenuePropertiesBase,
    gracePeriodExpiresAt: Schema.NullOr(Schema.Date),
  }),
});
export type RevenueSubscriptionBillingRetry = typeof RevenueSubscriptionBillingRetry.Type;

/** `RENEWAL_EXTENDED` / `RENEWAL_EXTENSION` — service-issued period extension. */
export const RevenueSubscriptionExtended = Schema.Struct({
  ...baseEventFields,
  eventName: Schema.Literal("$subscription.extended"),
  properties: Schema.Struct({
    ...revenuePropertiesBase,
    extendedTo: Schema.Date,
  }),
});
export type RevenueSubscriptionExtended = typeof RevenueSubscriptionExtended.Type;

/**
 * `DID_CHANGE_RENEWAL_PREF` — customer selected a different product for the
 * next renewal. Apple's semantics: takes effect at next billing cycle, NOT
 * immediately. The current subscription stays on the existing product mapping.
 */
export const RevenueSubscriptionProductChanged = Schema.Struct({
  ...baseEventFields,
  eventName: Schema.Literal("$subscription.product_changed"),
  properties: Schema.Struct({
    ...revenuePropertiesBase,
    newProviderProductKey: Schema.String,
  }),
});
export type RevenueSubscriptionProductChanged = typeof RevenueSubscriptionProductChanged.Type;

/** `OFFER_REDEEMED` — promotional / introductory / win-back offer applied. */
export const RevenueSubscriptionOfferRedeemed = Schema.Struct({
  ...baseEventFields,
  eventName: Schema.Literal("$subscription.offer_redeemed"),
  properties: Schema.Struct({
    ...revenuePropertiesBase,
    offerId: Schema.NullOr(Schema.String),
  }),
});
export type RevenueSubscriptionOfferRedeemed = typeof RevenueSubscriptionOfferRedeemed.Type;

/** `PRICE_INCREASE` — Apple has scheduled a price change for the next renewal. */
export const RevenueSubscriptionPriceIncreasePending = Schema.Struct({
  ...baseEventFields,
  eventName: Schema.Literal("$subscription.price_increase_pending"),
  properties: Schema.Struct({
    ...revenuePropertiesBase,
    ...moneyPropertiesFields,
    effectiveAt: Schema.NullOr(Schema.Date),
  }),
});
export type RevenueSubscriptionPriceIncreasePending =
  typeof RevenueSubscriptionPriceIncreasePending.Type;

/** `DID_CHANGE_RENEWAL_STATUS=AUTO_RENEW_ENABLED` — customer un-canceled. */
export const RevenueSubscriptionAutoRenewResumed = Schema.Struct({
  ...baseEventFields,
  eventName: Schema.Literal("$subscription.auto_renew_resumed"),
  properties: Schema.Struct({ ...revenuePropertiesBase }),
});
export type RevenueSubscriptionAutoRenewResumed = typeof RevenueSubscriptionAutoRenewResumed.Type;

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
  transferMode: SubscriptionTransferMode,
  transferReason: Schema.String,
  transferredAt: Schema.Date,
};

/**
 * Emitted on the SOURCE person when a subscription's ownership is transferred
 * away — e.g. a different identified user restored it on a shared device.
 */
export const RevenueSubscriptionTransferredOut = Schema.Struct({
  ...baseEventFields,
  eventName: Schema.Literal("$subscription.transferred_out"),
  properties: Schema.Struct({ ...transferPropertiesBase }),
});
export type RevenueSubscriptionTransferredOut = typeof RevenueSubscriptionTransferredOut.Type;

/** Emitted on the TARGET person — the mirror of `$subscription.transferred_out`. */
export const RevenueSubscriptionTransferredIn = Schema.Struct({
  ...baseEventFields,
  eventName: Schema.Literal("$subscription.transferred_in"),
  properties: Schema.Struct({ ...transferPropertiesBase }),
});
export type RevenueSubscriptionTransferredIn = typeof RevenueSubscriptionTransferredIn.Type;

/** `$subscription.transferred_out` analogue for non-consumable one-time purchases. */
export const RevenuePurchaseTransferredOut = Schema.Struct({
  ...baseEventFields,
  eventName: Schema.Literal("$purchase.transferred_out"),
  properties: Schema.Struct({ ...transferPropertiesBase }),
});
export type RevenuePurchaseTransferredOut = typeof RevenuePurchaseTransferredOut.Type;

/** Emitted on the TARGET person — the mirror of `$purchase.transferred_out`. */
export const RevenuePurchaseTransferredIn = Schema.Struct({
  ...baseEventFields,
  eventName: Schema.Literal("$purchase.transferred_in"),
  properties: Schema.Struct({ ...transferPropertiesBase }),
});
export type RevenuePurchaseTransferredIn = typeof RevenuePurchaseTransferredIn.Type;

/** All server-trusted revenue event variants accepted by the purchase outbox. */
export const RevenueEvent = Schema.Union([
  RevenuePurchaseCompleted,
  RevenuePurchaseRefunded,
  RevenuePurchaseRevoked,
  RevenueSubscriptionCreated,
  RevenueSubscriptionRenewed,
  RevenueSubscriptionCanceled,
  RevenueSubscriptionExpired,
  RevenueSubscriptionRefundReversed,
  RevenueSubscriptionBillingRetry,
  RevenueSubscriptionExtended,
  RevenueSubscriptionProductChanged,
  RevenueSubscriptionOfferRedeemed,
  RevenueSubscriptionPriceIncreasePending,
  RevenueSubscriptionAutoRenewResumed,
  RevenueSubscriptionTransferredOut,
  RevenueSubscriptionTransferredIn,
  RevenuePurchaseTransferredOut,
  RevenuePurchaseTransferredIn,
]);
export type RevenueEvent = typeof RevenueEvent.Type;

export { RevenueAnalyticsEventName as RevenueAnalyticsEventNameSchema };
export { RevenuePurchaseCompleted as RevenuePurchaseCompletedSchema };
export { RevenuePurchaseRefunded as RevenuePurchaseRefundedSchema };
export { RevenuePurchaseRevoked as RevenuePurchaseRevokedSchema };
export { RevenueSubscriptionCreated as RevenueSubscriptionCreatedSchema };
export { RevenueSubscriptionRenewed as RevenueSubscriptionRenewedSchema };
export { RevenueSubscriptionCanceled as RevenueSubscriptionCanceledSchema };
export { RevenueSubscriptionExpired as RevenueSubscriptionExpiredSchema };
export { RevenueSubscriptionRefundReversed as RevenueSubscriptionRefundReversedSchema };
export { RevenueSubscriptionBillingRetry as RevenueSubscriptionBillingRetrySchema };
export { RevenueSubscriptionExtended as RevenueSubscriptionExtendedSchema };
export { RevenueSubscriptionProductChanged as RevenueSubscriptionProductChangedSchema };
export { RevenueSubscriptionOfferRedeemed as RevenueSubscriptionOfferRedeemedSchema };
export { RevenueSubscriptionPriceIncreasePending as RevenueSubscriptionPriceIncreasePendingSchema };
export { RevenueSubscriptionAutoRenewResumed as RevenueSubscriptionAutoRenewResumedSchema };
export { RevenueSubscriptionTransferredOut as RevenueSubscriptionTransferredOutSchema };
export { RevenueSubscriptionTransferredIn as RevenueSubscriptionTransferredInSchema };
export { RevenuePurchaseTransferredOut as RevenuePurchaseTransferredOutSchema };
export { RevenuePurchaseTransferredIn as RevenuePurchaseTransferredInSchema };
