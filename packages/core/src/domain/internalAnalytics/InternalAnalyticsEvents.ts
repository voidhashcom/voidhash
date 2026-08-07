/**
 * Server-trusted analytics events emitted by internal services into the
 * analytics pipeline. The schema is a discriminated union of strict per-event
 * variants, discriminated on the wire-stable `eventName` literal. The same
 * `eventName` is what downstream consumers (analytics-writer ClickHouse insert)
 * see, so the literal serves as both the tagged-union discriminator and the
 * wire identifier.
 *
 * Adding a new event:
 *   1. Define a `Schema.Struct` for the variant with a unique `eventName`
 *      literal and a strictly-typed `properties` struct.
 *   2. Add it to `InternalAnalyticsEventSchema`'s union.
 *   3. Map it to a `routing.sourceTopic` in the api-app's analytics-bridge
 *      producer (currently only revenue events exist; all share
 *      `REVENUE_TRUSTED_SOURCE_TOPIC`).
 *
 * The trust constants (`RESERVED_REVENUE_EVENT_NAMES`,
 * `REVENUE_TRUSTED_SOURCE_TOPIC`) live here so the analytics-ingest services
 * (event-capture, event-processor) can import them without depending on
 * purchase-processing.
 */
import { constant } from "@voidhash/lib/lang";
import { Schema } from "effect";

import { SubscriptionTransferModeSchema } from "../paymentProvider/SubscriptionTransfer.ts";

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
  "$subscription.active",
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

export type RevenueAnalyticsEventName = typeof RevenueAnalyticsEventNameSchema.Type;

/**
 * Server-emitted analytics event names are prefixed with `$` (mirroring the
 * PostHog convention for auto-captured / reserved system events) so they can
 * never collide with the customer's own event names sent via the SDK.
 */
export const RESERVED_REVENUE_EVENT_NAMES: ReadonlySet<RevenueAnalyticsEventName> =
  new Set<RevenueAnalyticsEventName>([
    "$purchase.completed",
    "$purchase.refunded",
    "$purchase.revoked",
    "$purchase.transferred_out",
    "$purchase.transferred_in",
    "$subscription.created",
    "$subscription.renewed",
    "$subscription.canceled",
    "$subscription.expired",
    "$subscription.active",
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

/** Widened view of {@link RESERVED_REVENUE_EVENT_NAMES} for arbitrary-string membership checks. */
const reservedRevenueEventNames: ReadonlySet<string> = RESERVED_REVENUE_EVENT_NAMES;

export const isReservedRevenueEventName = (name: string): name is RevenueAnalyticsEventName =>
  reservedRevenueEventNames.has(name);

/**
 * Event names exempt from the per-event capture quota regardless of trust
 * class. Starts EMPTY: today no SDK event bypasses quota, so capture behaviour
 * is unchanged. Server-trusted revenue is exempt by construction (it never
 * enters the capture path — reserved names are rejected there), so it needs no
 * entry here; this set is the seam for allow-listing specific SDK event names
 * later without touching the capture orchestration.
 */
export const TRUST_BYPASS_QUOTA: ReadonlySet<string> = new Set<string>();

/**
 * Quota policy as a per-event-class predicate: whether an event should bypass
 * the per-event capture quota. `trusted-revenue` is always exempt (the
 * predicate is total even though revenue never reaches capture today), and
 * specific SDK event names can be allow-listed via {@link TRUST_BYPASS_QUOTA}.
 *
 * `trustClass` is typed as a plain string to avoid a circular import with the
 * analytics-ingest domain (which already imports from here).
 */
export const shouldBypassQuota = (input: {
  readonly trustClass?: string;
  readonly eventName: string;
}): boolean => input.trustClass === "trusted-revenue" || TRUST_BYPASS_QUOTA.has(input.eventName);

/**
 * The `routing.sourceTopic` value stamped onto every server-emitted revenue
 * event. The processor's trust check uses this to distinguish trusted revenue
 * events from any reserved-named event that somehow reached the capture
 * pipeline.
 */
export const REVENUE_TRUSTED_SOURCE_TOPIC = constant("revenue.trusted.v1");

/**
 * The `routing.sourceTopic` stamped onto server-emitted experiment-exposure
 * events. A dedicated NON-revenue trusted topic so exposure never rides the
 * revenue trust checks / MRR math (which key on `REVENUE_TRUSTED_SOURCE_TOPIC`
 * and the reserved revenue event-name set — `$experiment.exposed` is in
 * neither).
 */
export const EXPERIMENT_TRUSTED_SOURCE_TOPIC = constant("experiment.trusted.v1");

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
  providerEnvironment: Schema.Number,
  providerEventType: Schema.String,
  providerId: Schema.String,
  providerSubscriptionId: Schema.NullOr(Schema.String),
  providerTransactionId: Schema.NullOr(Schema.String),
  providerWebhookNotificationId: Schema.NullOr(Schema.String),
  source: Schema.String,
};

/**
 * Money-bearing properties shared by every revenue event variant. All amounts
 * are SIGNED deltas in the unified reporting currency (USD) minor units, so
 * `SUM(grossAmountUsd)` over `$purchase.*` / `$subscription.*` events equals
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

export type RevenuePurchaseCompleted = typeof RevenuePurchaseCompletedSchema.Type;

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

export type RevenuePurchaseRefunded = typeof RevenuePurchaseRefundedSchema.Type;

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

export type RevenuePurchaseRevoked = typeof RevenuePurchaseRevokedSchema.Type;

export const RevenueSubscriptionCreatedSchema = Schema.Struct({
  ...baseEventFields,
  eventName: Schema.Literal("$subscription.created"),
  properties: Schema.Struct({
    ...revenuePropertiesBase,
    ...moneyPropertiesFields,
    isTrial: Schema.Boolean,
  }),
});

export type RevenueSubscriptionCreated = typeof RevenueSubscriptionCreatedSchema.Type;

export const RevenueSubscriptionRenewedSchema = Schema.Struct({
  ...baseEventFields,
  eventName: Schema.Literal("$subscription.renewed"),
  properties: Schema.Struct({
    ...revenuePropertiesBase,
    ...moneyPropertiesFields,
    isTrial: Schema.Boolean,
  }),
});

export type RevenueSubscriptionRenewed = typeof RevenueSubscriptionRenewedSchema.Type;

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

export type RevenueSubscriptionCanceled = typeof RevenueSubscriptionCanceledSchema.Type;

export const RevenueSubscriptionExpiredSchema = Schema.Struct({
  ...baseEventFields,
  eventName: Schema.Literal("$subscription.expired"),
  properties: Schema.Struct({ ...revenuePropertiesBase }),
});

export type RevenueSubscriptionExpired = typeof RevenueSubscriptionExpiredSchema.Type;

export const RevenueSubscriptionActiveSchema = Schema.Struct({
  ...baseEventFields,
  eventName: Schema.Literal("$subscription.active"),
  properties: Schema.Struct({ ...revenuePropertiesBase }),
});

export type RevenueSubscriptionActive = typeof RevenueSubscriptionActiveSchema.Type;

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

export type RevenueSubscriptionRefundReversed = typeof RevenueSubscriptionRefundReversedSchema.Type;

/** `DID_FAIL_TO_RENEW` — subscription entered the billing-retry loop. */
export const RevenueSubscriptionBillingRetrySchema = Schema.Struct({
  ...baseEventFields,
  eventName: Schema.Literal("$subscription.billing_retry"),
  properties: Schema.Struct({
    ...revenuePropertiesBase,
    gracePeriodExpiresAt: Schema.NullOr(Schema.Date),
  }),
});

export type RevenueSubscriptionBillingRetry = typeof RevenueSubscriptionBillingRetrySchema.Type;

/** `RENEWAL_EXTENDED` / `RENEWAL_EXTENSION` — service-issued period extension. */
export const RevenueSubscriptionExtendedSchema = Schema.Struct({
  ...baseEventFields,
  eventName: Schema.Literal("$subscription.extended"),
  properties: Schema.Struct({
    ...revenuePropertiesBase,
    extendedTo: Schema.Date,
  }),
});

export type RevenueSubscriptionExtended = typeof RevenueSubscriptionExtendedSchema.Type;

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

export type RevenueSubscriptionProductChanged = typeof RevenueSubscriptionProductChangedSchema.Type;

/** `OFFER_REDEEMED` — promotional / introductory / win-back offer applied. */
export const RevenueSubscriptionOfferRedeemedSchema = Schema.Struct({
  ...baseEventFields,
  eventName: Schema.Literal("$subscription.offer_redeemed"),
  properties: Schema.Struct({
    ...revenuePropertiesBase,
    offerId: Schema.NullOr(Schema.String),
  }),
});

export type RevenueSubscriptionOfferRedeemed = typeof RevenueSubscriptionOfferRedeemedSchema.Type;

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

export type RevenueSubscriptionPriceIncreasePending =
  typeof RevenueSubscriptionPriceIncreasePendingSchema.Type;

/** `DID_CHANGE_RENEWAL_STATUS=AUTO_RENEW_ENABLED` — customer un-canceled. */
export const RevenueSubscriptionAutoRenewResumedSchema = Schema.Struct({
  ...baseEventFields,
  eventName: Schema.Literal("$subscription.auto_renew_resumed"),
  properties: Schema.Struct({ ...revenuePropertiesBase }),
});

export type RevenueSubscriptionAutoRenewResumed =
  typeof RevenueSubscriptionAutoRenewResumedSchema.Type;

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

export type RevenueSubscriptionTransferredOut = typeof RevenueSubscriptionTransferredOutSchema.Type;

/** Emitted on the TARGET person — the mirror of `$subscription.transferred_out`. */
export const RevenueSubscriptionTransferredInSchema = Schema.Struct({
  ...baseEventFields,
  eventName: Schema.Literal("$subscription.transferred_in"),
  properties: Schema.Struct({ ...transferPropertiesBase }),
});

export type RevenueSubscriptionTransferredIn = typeof RevenueSubscriptionTransferredInSchema.Type;

/** `$subscription.transferred_out` analogue for non-consumable one-time purchases. */
export const RevenuePurchaseTransferredOutSchema = Schema.Struct({
  ...baseEventFields,
  eventName: Schema.Literal("$purchase.transferred_out"),
  properties: Schema.Struct({ ...transferPropertiesBase }),
});

export type RevenuePurchaseTransferredOut = typeof RevenuePurchaseTransferredOutSchema.Type;

/** Emitted on the TARGET person — the mirror of `$purchase.transferred_out`. */
export const RevenuePurchaseTransferredInSchema = Schema.Struct({
  ...baseEventFields,
  eventName: Schema.Literal("$purchase.transferred_in"),
  properties: Schema.Struct({ ...transferPropertiesBase }),
});

export type RevenuePurchaseTransferredIn = typeof RevenuePurchaseTransferredInSchema.Type;

/**
 * Experiment exposure — emitted server-side when a subject is assigned a
 * variant of a running experiment at serve time. `personId` is nullable because
 * paywalls are frequently shown to anonymous (pre-identify) users; the pipeline
 * keys the event by `distinctId` and stitches identity on read. Distinct base
 * fields from the revenue events (no `transactionId`, optional `personId`).
 */
export const ExperimentExposedSchema = Schema.Struct({
  context: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  distinctId: Schema.String,
  eventId: Schema.String,
  eventName: Schema.Literal("$experiment.exposed"),
  occurredAt: Schema.Date,
  organizationId: Schema.String,
  personId: Schema.NullOr(Schema.String),
  projectId: Schema.String,
  properties: Schema.Struct({
    experimentId: Schema.String,
    variantKey: Schema.String,
  }),
  token: Schema.String,
});

export type ExperimentExposed = typeof ExperimentExposedSchema.Type;

export const InternalAnalyticsEventSchema = Schema.Union([
  ExperimentExposedSchema,
  RevenuePurchaseCompletedSchema,
  RevenuePurchaseRefundedSchema,
  RevenuePurchaseRevokedSchema,
  RevenueSubscriptionCreatedSchema,
  RevenueSubscriptionRenewedSchema,
  RevenueSubscriptionCanceledSchema,
  RevenueSubscriptionExpiredSchema,
  RevenueSubscriptionActiveSchema,
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

export type InternalAnalyticsEvent = typeof InternalAnalyticsEventSchema.Type;

export const sourceTopicForInternalAnalyticsEvent = (event: InternalAnalyticsEvent): string => {
  switch (event.eventName) {
    case "$experiment.exposed":
      return EXPERIMENT_TRUSTED_SOURCE_TOPIC;
    case "$purchase.completed":
    case "$purchase.refunded":
    case "$purchase.revoked":
    case "$purchase.transferred_out":
    case "$purchase.transferred_in":
    case "$subscription.created":
    case "$subscription.renewed":
    case "$subscription.canceled":
    case "$subscription.expired":
    case "$subscription.active":
    case "$subscription.refund_reversed":
    case "$subscription.billing_retry":
    case "$subscription.extended":
    case "$subscription.product_changed":
    case "$subscription.offer_redeemed":
    case "$subscription.price_increase_pending":
    case "$subscription.auto_renew_resumed":
    case "$subscription.transferred_out":
    case "$subscription.transferred_in":
      return REVENUE_TRUSTED_SOURCE_TOPIC;
  }
};
