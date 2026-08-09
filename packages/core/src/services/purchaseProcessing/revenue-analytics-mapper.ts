/**
 * Per-action mappers that translate a successful purchase write into the
 * `InternalAnalyticsEvent` variants the analytics pipeline ingests. Each event's
 * `eventId` is a DETERMINISTIC id derived from `(idempotencyKey, eventName,
 * personId)` via {@link deterministicAnalyticsEventId} — stable across retries
 * and re-dispatch, so the at-least-once analytics queue dedupes duplicates on
 * the ClickHouse `(project_id, event_id)` key rather than relying on a single
 * upstream invocation. The ledger `idempotency_key` is the per-action anchor
 * (one ledger row ⇒ one mapper call), and `(eventName, personId)` disambiguates
 * the multi-event actions (a subscription start emits two named events; a
 * transfer emits two events on different persons).
 *
 * Sign convention for the money payload:
 *   +1  purchases, renewals, refund reversals → emit positive deltas
 *   −1  refunds, purchase revokes, and family-revoke cancellations → emit negative deltas
 * Summing `grossAmountUsd` (or any of the breakdown columns) over the
 * `$purchase.*` / `$subscription.*` revenue events therefore yields net
 * revenue with no per-event-type branching downstream.
 */
import { Option } from "effect";

import {
  REVENUE_TRUSTED_SOURCE_TOPIC,
  type RevenuePurchaseCompleted,
  type RevenuePurchaseRefunded,
  type RevenuePurchaseRevoked,
  type RevenuePurchaseTransferredIn,
  type RevenuePurchaseTransferredOut,
  type RevenueSubscriptionAutoRenewResumed,
  type RevenueSubscriptionBillingRetry,
  type RevenueSubscriptionCanceled,
  type RevenueSubscriptionCreated,
  type RevenueSubscriptionExpired,
  type RevenueSubscriptionExtended,
  type RevenueSubscriptionOfferRedeemed,
  type RevenueSubscriptionPriceIncreasePending,
  type RevenueSubscriptionProductChanged,
  type RevenueSubscriptionRefundReversed,
  type RevenueSubscriptionRenewed,
  type RevenueSubscriptionTransferredIn,
  type RevenueSubscriptionTransferredOut,
} from "../../domain/internalAnalytics/InternalAnalyticsEvents.ts";
import type { SubscriptionTransferMode } from "../../domain/paymentProvider/SubscriptionTransfer.ts";
import type { PurchaseProcessingMoney } from "../../domain/purchaseProcessing/PurchaseProcessing.ts";
import { deterministicAnalyticsEventId } from "../../utils/deterministic-id.ts";

export interface RevenueAnalyticsMapperContext {
  readonly token: string;
  readonly organizationId: string;
  readonly projectId: string;
  /**
   * The purchase-ledger `idempotency_key` for the action being mapped — the
   * stable anchor for every event's deterministic `eventId`. One ledger row
   * maps to exactly one mapper call, so this is unique per logical action.
   */
  readonly idempotencyKey: string;
  /**
   * The primary distinct id of the person this action is attributed to,
   * resolved server-side (`_resolveDistinctId`). Stamped as the single-person
   * events' `distinctId` so revenue carries a REAL distinct id (not the
   * `personId`): a later identity merge then re-attributes these events through
   * the identity overrides exactly like SDK events. Transfer events stamp the
   * real source / target distinct ids directly and do not read this.
   */
  readonly distinctId: string;
}

interface CommonAnalyticsFields {
  readonly providerId: string;
  readonly source: string;
  readonly providerEventType: string;
  readonly providerEnvironment: number;
  readonly paymentProviderConfigurationId: string;
  readonly paymentProviderConfigurationProductId: string;
  readonly providerTransactionId: Option.Option<string>;
  readonly providerSubscriptionId: Option.Option<string>;
  readonly providerWebhookNotificationId: Option.Option<string>;
}

interface RevenuePropertiesBase {
  readonly paymentProviderConfigurationId: string;
  readonly paymentProviderConfigurationProductId: string;
  readonly providerEnvironment: number;
  readonly providerEventType: string;
  readonly providerId: string;
  readonly providerSubscriptionId: string | null;
  readonly providerTransactionId: string | null;
  readonly providerWebhookNotificationId: string | null;
  readonly source: string;
}

interface MoneyProperties {
  readonly amount?: number | null;
  readonly amountUsd?: number | null;
  readonly currency?: string;
  readonly storefront?: string | null;
  readonly grossAmount?: number | null;
  readonly storeCommissionAmount?: number | null;
  readonly taxAmount?: number | null;
  readonly proceedsAmount?: number | null;
  readonly proceedsAfterTaxAmount?: number | null;
  readonly grossAmountUsd?: number | null;
  readonly storeCommissionAmountUsd?: number | null;
  readonly taxAmountUsd?: number | null;
  readonly proceedsAmountUsd?: number | null;
  readonly proceedsAfterTaxAmountUsd?: number | null;
  readonly exchangeRate?: number | null;
}

interface EventEnvelope {
  readonly context: Record<string, unknown>;
  readonly distinctId: string;
  readonly eventId: string;
  readonly occurredAt: Date;
  readonly organizationId: string;
  readonly personId: string;
  readonly projectId: string;
  readonly token: string;
  readonly transactionId: string | null;
}

const revenuePropertiesBase = (input: CommonAnalyticsFields): RevenuePropertiesBase => ({
  paymentProviderConfigurationId: input.paymentProviderConfigurationId,
  paymentProviderConfigurationProductId: input.paymentProviderConfigurationProductId,
  providerEnvironment: input.providerEnvironment,
  providerEventType: input.providerEventType,
  providerId: input.providerId,
  providerSubscriptionId: Option.getOrNull(input.providerSubscriptionId),
  providerTransactionId: Option.getOrNull(input.providerTransactionId),
  providerWebhookNotificationId: Option.getOrNull(input.providerWebhookNotificationId),
  source: input.source,
});

/**
 * Maps a {@link PurchaseProcessingMoney} into the wire-shaped money payload,
 * applying the sign convention (+1 for purchases / renewals / reversed
 * refunds, −1 for refunds / family revokes). `Option.none()` money emits
 * no money fields at all, so downstream `SUM`s don't double-count
 * money-less events.
 *
 * `amount` / `amountUsd` mirror `grossAmount` / `grossAmountUsd` for the
 * benefit of readers that haven't migrated to the breakdown columns yet.
 */
const signedMoneyProperties = (
  money: Option.Option<PurchaseProcessingMoney>,
  sign: 1 | -1,
): MoneyProperties =>
  Option.match(money, {
    onNone: () => ({}),
    onSome: (m) => {
      const usd = Option.getOrUndefined(m.usd);
      const signed = (n: number) => sign * n;
      const signedUsd = (n: number | undefined) => {
        if (n === undefined) {
          return null;
        }
        return sign * n;
      };
      return {
        amount: signed(m.grossAmount),
        amountUsd: signedUsd(usd?.grossAmount),
        currency: m.currency,
        exchangeRate: usd?.exchangeRate ?? null,
        grossAmount: signed(m.grossAmount),
        grossAmountUsd: signedUsd(usd?.grossAmount),
        proceedsAfterTaxAmount: signed(m.proceedsAfterTaxAmount),
        proceedsAfterTaxAmountUsd: signedUsd(usd?.proceedsAfterTaxAmount),
        proceedsAmount: signed(m.proceedsAmount),
        proceedsAmountUsd: signedUsd(usd?.proceedsAmount),
        storeCommissionAmount: signed(m.storeCommissionAmount),
        storeCommissionAmountUsd: signedUsd(usd?.storeCommissionAmount),
        storefront: Option.getOrNull(m.storefront),
        taxAmount: signed(m.taxAmount),
        taxAmountUsd: signedUsd(usd?.taxAmount),
      };
    },
  });

const baseContext = (): Record<string, unknown> => ({
  sourceTopic: REVENUE_TRUSTED_SOURCE_TOPIC,
});

/**
 * Builds the shared envelope for a single-person revenue event. The `eventId`
 * is derived deterministically from the ledger `idempotencyKey` (anchor), the
 * `eventName`, and the `personId`, so it is stable across re-dispatch. The
 * transfer pair builders below do NOT use this helper — they stamp the real
 * source / target distinct ids onto two events, deriving each id from the
 * respective person.
 */
const buildEnvelope = (input: {
  readonly eventName: string;
  readonly occurredAt: Date;
  readonly personId: string;
  readonly transactionId: string | null;
  readonly cfg: RevenueAnalyticsMapperContext;
}): EventEnvelope => ({
  context: baseContext(),
  distinctId: input.cfg.distinctId,
  eventId: deterministicAnalyticsEventId({
    anchor: input.cfg.idempotencyKey,
    eventName: input.eventName,
    personId: input.personId,
  }),
  occurredAt: input.occurredAt,
  organizationId: input.cfg.organizationId,
  personId: input.personId,
  projectId: input.cfg.projectId,
  token: input.cfg.token,
  transactionId: input.transactionId,
});

/**
 * `subscription.started` emits two events anchored on the new transaction id:
 * the customer-facing `subscription.created` event and the revenue-facing
 * `purchase.completed` event.
 */
export const toStartedAnalyticsInputs = (
  input: CommonAnalyticsFields & {
    readonly occurredAt: Date;
    readonly isTrial: boolean;
    readonly money: Option.Option<PurchaseProcessingMoney>;
  },
  result: { readonly personId: string; readonly transactionId: Option.Option<string> },
  cfg: RevenueAnalyticsMapperContext,
): ReadonlyArray<RevenueSubscriptionCreated | RevenuePurchaseCompleted> => {
  if (Option.isNone(result.transactionId)) {
    return [];
  }
  const transactionId = result.transactionId.value;
  const base = revenuePropertiesBase(input);
  const money = signedMoneyProperties(input.money, 1);
  const created: RevenueSubscriptionCreated = {
    ...buildEnvelope({
      cfg,
      eventName: "$subscription.created",
      occurredAt: input.occurredAt,
      personId: result.personId,
      transactionId,
    }),
    eventName: "$subscription.created",
    properties: { ...base, ...money, isTrial: input.isTrial },
  };
  const completed: RevenuePurchaseCompleted = {
    ...buildEnvelope({
      cfg,
      eventName: "$purchase.completed",
      occurredAt: input.occurredAt,
      personId: result.personId,
      transactionId,
    }),
    eventName: "$purchase.completed",
    properties: { ...base, ...money, isTrial: input.isTrial },
  };
  return [created, completed];
};

export const toRenewedAnalyticsInputs = (
  input: CommonAnalyticsFields & {
    readonly occurredAt: Date;
    readonly isTrial: boolean;
    readonly money: Option.Option<PurchaseProcessingMoney>;
  },
  result: { readonly personId: string; readonly transactionId: Option.Option<string> },
  cfg: RevenueAnalyticsMapperContext,
): ReadonlyArray<RevenueSubscriptionRenewed> => {
  if (Option.isNone(result.transactionId)) {
    return [];
  }
  const transactionId = result.transactionId.value;
  return [
    {
      ...buildEnvelope({
        cfg,
        eventName: "$subscription.renewed",
        occurredAt: input.occurredAt,
        personId: result.personId,
        transactionId,
      }),
      eventName: "$subscription.renewed",
      properties: {
        ...revenuePropertiesBase(input),
        ...signedMoneyProperties(input.money, 1),
        isTrial: input.isTrial,
      },
    },
  ];
};

export const toCanceledAnalyticsInputs = (
  input: CommonAnalyticsFields & {
    readonly canceledAt: Date;
    readonly cancelAtPeriodEnd: boolean;
    readonly cancellationReason: Option.Option<string>;
  },
  result: { readonly personId: string; readonly subscriptionId: Option.Option<string> },
  cfg: RevenueAnalyticsMapperContext,
): ReadonlyArray<RevenueSubscriptionCanceled> => {
  if (Option.isNone(result.subscriptionId)) {
    return [];
  }
  return [
    {
      ...buildEnvelope({
        cfg,
        eventName: "$subscription.canceled",
        occurredAt: input.canceledAt,
        personId: result.personId,
        transactionId: null,
      }),
      eventName: "$subscription.canceled",
      properties: {
        ...revenuePropertiesBase(input),
        cancelAtPeriodEnd: input.cancelAtPeriodEnd,
        cancellationReason: Option.getOrNull(input.cancellationReason),
      },
    },
  ];
};

export const toExpiredAnalyticsInputs = (
  input: CommonAnalyticsFields & { readonly expiredAt: Date },
  result: { readonly personId: string; readonly subscriptionId: Option.Option<string> },
  cfg: RevenueAnalyticsMapperContext,
): ReadonlyArray<RevenueSubscriptionExpired> => {
  if (Option.isNone(result.subscriptionId)) {
    return [];
  }
  return [
    {
      ...buildEnvelope({
        cfg,
        eventName: "$subscription.expired",
        occurredAt: input.expiredAt,
        personId: result.personId,
        transactionId: null,
      }),
      eventName: "$subscription.expired",
      properties: revenuePropertiesBase(input),
    },
  ];
};

/**
 * Provider-issued revocation (Apple's `REVOKE`, typically a Family-Sharing
 * member's access). Carries a signed-negative money delta when `money` is
 * present: family-shared transactions have zero commission / proceeds so
 * the negative gross is the only meaningful entry; this keeps the gross-
 * entitlement sum accurate without affecting net revenue.
 */
export const toRevokedAnalyticsInputs = (
  input: CommonAnalyticsFields & {
    readonly revokedAt: Date;
    readonly revocationReason: Option.Option<string>;
    readonly money: Option.Option<PurchaseProcessingMoney>;
  },
  result: { readonly personId: string; readonly subscriptionId: Option.Option<string> },
  cfg: RevenueAnalyticsMapperContext,
): ReadonlyArray<RevenueSubscriptionCanceled> => {
  if (Option.isNone(result.subscriptionId)) {
    return [];
  }
  return [
    {
      ...buildEnvelope({
        cfg,
        eventName: "$subscription.canceled",
        occurredAt: input.revokedAt,
        personId: result.personId,
        transactionId: null,
      }),
      eventName: "$subscription.canceled",
      properties: {
        ...revenuePropertiesBase(input),
        ...signedMoneyProperties(input.money, -1),
        revocationReason: Option.getOrNull(input.revocationReason),
      },
    },
  ];
};

export const toOneTimePurchaseAnalyticsInputs = (
  input: CommonAnalyticsFields & {
    readonly occurredAt: Date;
    readonly purchaseType: "one-time" | "consumable";
    readonly money: Option.Option<PurchaseProcessingMoney>;
  },
  result: { readonly personId: string; readonly transactionId: Option.Option<string> },
  cfg: RevenueAnalyticsMapperContext,
): ReadonlyArray<RevenuePurchaseCompleted> => {
  if (Option.isNone(result.transactionId)) {
    return [];
  }
  const transactionId = result.transactionId.value;
  return [
    {
      ...buildEnvelope({
        cfg,
        eventName: "$purchase.completed",
        occurredAt: input.occurredAt,
        personId: result.personId,
        transactionId,
      }),
      eventName: "$purchase.completed",
      properties: {
        ...revenuePropertiesBase(input),
        ...signedMoneyProperties(input.money, 1),
        purchaseType: input.purchaseType,
      },
    },
  ];
};

export const toRefundedAnalyticsInputs = (
  input: CommonAnalyticsFields & {
    readonly refundedAt: Date;
    readonly refundReason: Option.Option<string>;
    readonly money: Option.Option<PurchaseProcessingMoney>;
  },
  result: { readonly personId: string },
  cfg: RevenueAnalyticsMapperContext,
): ReadonlyArray<RevenuePurchaseRefunded> => [
  {
    ...buildEnvelope({
      cfg,
      eventName: "$purchase.refunded",
      occurredAt: input.refundedAt,
      personId: result.personId,
      transactionId: Option.getOrNull(input.providerTransactionId),
    }),
    eventName: "$purchase.refunded",
    properties: {
      ...revenuePropertiesBase(input),
      ...signedMoneyProperties(input.money, -1),
      refundReason: Option.getOrNull(input.refundReason),
    },
  },
];

export const toPurchaseRevokedAnalyticsInputs = (
  input: CommonAnalyticsFields & {
    readonly revokedAt: Date;
    readonly revocationReason: Option.Option<string>;
    readonly money: Option.Option<PurchaseProcessingMoney>;
  },
  result: { readonly personId: string },
  cfg: RevenueAnalyticsMapperContext,
): ReadonlyArray<RevenuePurchaseRevoked> => [
  {
    ...buildEnvelope({
      cfg,
      eventName: "$purchase.revoked",
      occurredAt: input.revokedAt,
      personId: result.personId,
      transactionId: Option.getOrNull(input.providerTransactionId),
    }),
    eventName: "$purchase.revoked",
    properties: {
      ...revenuePropertiesBase(input),
      ...signedMoneyProperties(input.money, -1),
      revocationReason: Option.getOrNull(input.revocationReason),
    },
  },
];

/**
 * `subscription.refund_reversed` — Apple has reversed a prior refund and the
 * entitlement is re-granted. Emits the original purchase's money breakdown
 * with the positive sign so the net-revenue sum cancels out the negative
 * delta from the earlier `$purchase.refunded`.
 */
export const toRefundReversedAnalyticsInputs = (
  input: CommonAnalyticsFields & {
    readonly reversedAt: Date;
    readonly money: Option.Option<PurchaseProcessingMoney>;
  },
  result: { readonly personId: string },
  cfg: RevenueAnalyticsMapperContext,
): ReadonlyArray<RevenueSubscriptionRefundReversed> => [
  {
    ...buildEnvelope({
      cfg,
      eventName: "$subscription.refund_reversed",
      occurredAt: input.reversedAt,
      personId: result.personId,
      transactionId: Option.getOrNull(input.providerTransactionId),
    }),
    eventName: "$subscription.refund_reversed",
    properties: {
      ...revenuePropertiesBase(input),
      ...signedMoneyProperties(input.money, 1),
    },
  },
];

export const toBillingRetryAnalyticsInputs = (
  input: CommonAnalyticsFields & {
    readonly occurredAt: Date;
    readonly gracePeriodExpiresAt: Option.Option<Date>;
  },
  result: { readonly personId: string; readonly subscriptionId: Option.Option<string> },
  cfg: RevenueAnalyticsMapperContext,
): ReadonlyArray<RevenueSubscriptionBillingRetry> => {
  if (Option.isNone(result.subscriptionId)) {
    return [];
  }
  return [
    {
      ...buildEnvelope({
        cfg,
        eventName: "$subscription.billing_retry",
        occurredAt: input.occurredAt,
        personId: result.personId,
        transactionId: null,
      }),
      eventName: "$subscription.billing_retry",
      properties: {
        ...revenuePropertiesBase(input),
        gracePeriodExpiresAt: Option.getOrNull(input.gracePeriodExpiresAt),
      },
    },
  ];
};

export const toExtendedAnalyticsInputs = (
  input: CommonAnalyticsFields & {
    readonly occurredAt: Date;
    readonly extendedTo: Date;
  },
  result: { readonly personId: string; readonly subscriptionId: Option.Option<string> },
  cfg: RevenueAnalyticsMapperContext,
): ReadonlyArray<RevenueSubscriptionExtended> => {
  if (Option.isNone(result.subscriptionId)) {
    return [];
  }
  return [
    {
      ...buildEnvelope({
        cfg,
        eventName: "$subscription.extended",
        occurredAt: input.occurredAt,
        personId: result.personId,
        transactionId: null,
      }),
      eventName: "$subscription.extended",
      properties: {
        ...revenuePropertiesBase(input),
        extendedTo: input.extendedTo,
      },
    },
  ];
};

export const toRenewalPreferenceChangeAnalyticsInputs = (
  input: CommonAnalyticsFields & {
    readonly occurredAt: Date;
    readonly newProviderProductKey: string;
  },
  result: { readonly personId: string; readonly subscriptionId: Option.Option<string> },
  cfg: RevenueAnalyticsMapperContext,
): ReadonlyArray<RevenueSubscriptionProductChanged> => {
  if (Option.isNone(result.subscriptionId)) {
    return [];
  }
  return [
    {
      ...buildEnvelope({
        cfg,
        eventName: "$subscription.product_changed",
        occurredAt: input.occurredAt,
        personId: result.personId,
        transactionId: null,
      }),
      eventName: "$subscription.product_changed",
      properties: {
        ...revenuePropertiesBase(input),
        newProviderProductKey: input.newProviderProductKey,
      },
    },
  ];
};

export const toOfferRedeemedAnalyticsInputs = (
  input: CommonAnalyticsFields & {
    readonly occurredAt: Date;
    readonly offerId: Option.Option<string>;
  },
  result: { readonly personId: string; readonly subscriptionId: Option.Option<string> },
  cfg: RevenueAnalyticsMapperContext,
): ReadonlyArray<RevenueSubscriptionOfferRedeemed> => {
  if (Option.isNone(result.subscriptionId)) {
    return [];
  }
  return [
    {
      ...buildEnvelope({
        cfg,
        eventName: "$subscription.offer_redeemed",
        occurredAt: input.occurredAt,
        personId: result.personId,
        transactionId: null,
      }),
      eventName: "$subscription.offer_redeemed",
      properties: {
        ...revenuePropertiesBase(input),
        offerId: Option.getOrNull(input.offerId),
      },
    },
  ];
};

/**
 * `$subscription.price_increase_pending` is informational (the new price
 * doesn't ship money until the next renewal). Carries the upcoming price as
 * an UNSIGNED breakdown so analytics can show "the new price will be X"
 * without affecting any net-revenue sums.
 */
export const toPriceIncreaseAnalyticsInputs = (
  input: CommonAnalyticsFields & {
    readonly occurredAt: Date;
    readonly effectiveAt: Option.Option<Date>;
    readonly money: Option.Option<PurchaseProcessingMoney>;
  },
  result: { readonly personId: string; readonly subscriptionId: Option.Option<string> },
  cfg: RevenueAnalyticsMapperContext,
): ReadonlyArray<RevenueSubscriptionPriceIncreasePending> => {
  if (Option.isNone(result.subscriptionId)) {
    return [];
  }
  return [
    {
      ...buildEnvelope({
        cfg,
        eventName: "$subscription.price_increase_pending",
        occurredAt: input.occurredAt,
        personId: result.personId,
        transactionId: null,
      }),
      eventName: "$subscription.price_increase_pending",
      properties: {
        ...revenuePropertiesBase(input),
        ...signedMoneyProperties(input.money, 1),
        effectiveAt: Option.getOrNull(input.effectiveAt),
      },
    },
  ];
};

export const toAutoRenewResumedAnalyticsInputs = (
  input: CommonAnalyticsFields & { readonly occurredAt: Date },
  result: { readonly personId: string; readonly subscriptionId: Option.Option<string> },
  cfg: RevenueAnalyticsMapperContext,
): ReadonlyArray<RevenueSubscriptionAutoRenewResumed> => {
  if (Option.isNone(result.subscriptionId)) {
    return [];
  }
  return [
    {
      ...buildEnvelope({
        cfg,
        eventName: "$subscription.auto_renew_resumed",
        occurredAt: input.occurredAt,
        personId: result.personId,
        transactionId: null,
      }),
      eventName: "$subscription.auto_renew_resumed",
      properties: revenuePropertiesBase(input),
    },
  ];
};

export interface SubscriptionTransferAnalyticsInput {
  readonly subscription: {
    readonly id: string;
    readonly storeSubscriptionId: string;
    readonly paymentProviderConfigurationProductId: string;
    readonly providerEnvironment: number;
  };
  readonly providerId: string;
  readonly paymentProviderConfigurationId: string;
  readonly fromPersonId: string;
  readonly fromDistinctId: string;
  readonly toPersonId: string;
  readonly toDistinctId: string;
  readonly transferMode: SubscriptionTransferMode;
  readonly triggerReason: string;
  readonly occurredAt: Date;
  readonly source: string;
}

/**
 * Maps a committed subscription ownership transfer into the
 * `$subscription.transferred_out` / `$subscription.transferred_in` pair. The
 * `_out` event is anchored on the SOURCE identity, the `_in` event on the
 * TARGET identity — they carry different `distinctId` / `personId` but the
 * SAME `properties` payload so a downstream consumer can correlate the two
 * halves of the transfer.
 *
 * Built explicitly rather than via {@link buildEnvelope}: that helper stamps a
 * single person's id as both `distinctId` and `personId`, whereas a transfer
 * pair must stamp the real source / target distinct ids onto the two events.
 * Each event's deterministic `eventId` is anchored on the ledger
 * `idempotencyKey` and disambiguated by `(eventName, personId)`, so the two
 * halves get distinct, stable ids.
 */
export const toSubscriptionTransferredAnalyticsInputs = (
  input: SubscriptionTransferAnalyticsInput,
  cfg: RevenueAnalyticsMapperContext,
): ReadonlyArray<RevenueSubscriptionTransferredOut | RevenueSubscriptionTransferredIn> => {
  const properties = {
    fromDistinctId: input.fromDistinctId,
    fromPersonId: input.fromPersonId,
    paymentProviderConfigurationId: input.paymentProviderConfigurationId,
    paymentProviderConfigurationProductId: input.subscription.paymentProviderConfigurationProductId,
    providerEnvironment: input.subscription.providerEnvironment,
    providerEventType: "subscription.transferred",
    providerId: input.providerId,
    source: input.source,
    storeSubscriptionId: input.subscription.storeSubscriptionId,
    subscriptionId: input.subscription.id,
    toDistinctId: input.toDistinctId,
    toPersonId: input.toPersonId,
    transferMode: input.transferMode,
    transferReason: input.triggerReason,
    transferredAt: input.occurredAt,
  };
  const transferredOut: RevenueSubscriptionTransferredOut = {
    context: baseContext(),
    distinctId: input.fromDistinctId,
    eventId: deterministicAnalyticsEventId({
      anchor: cfg.idempotencyKey,
      eventName: "$subscription.transferred_out",
      personId: input.fromPersonId,
    }),
    eventName: "$subscription.transferred_out",
    occurredAt: input.occurredAt,
    organizationId: cfg.organizationId,
    personId: input.fromPersonId,
    projectId: cfg.projectId,
    properties,
    token: cfg.token,
    transactionId: null,
  };
  const transferredIn: RevenueSubscriptionTransferredIn = {
    context: baseContext(),
    distinctId: input.toDistinctId,
    eventId: deterministicAnalyticsEventId({
      anchor: cfg.idempotencyKey,
      eventName: "$subscription.transferred_in",
      personId: input.toPersonId,
    }),
    eventName: "$subscription.transferred_in",
    occurredAt: input.occurredAt,
    organizationId: cfg.organizationId,
    personId: input.toPersonId,
    projectId: cfg.projectId,
    properties,
    token: cfg.token,
    transactionId: null,
  };
  return [transferredOut, transferredIn];
};

export interface PurchaseTransferAnalyticsInput {
  readonly purchase: {
    readonly id: string;
    readonly providerKey: string;
    readonly paymentProviderConfigurationProductId: string;
    readonly providerEnvironment: number;
  };
  readonly providerId: string;
  readonly paymentProviderConfigurationId: string;
  readonly fromPersonId: string;
  readonly fromDistinctId: string;
  readonly toPersonId: string;
  readonly toDistinctId: string;
  readonly transferMode: SubscriptionTransferMode;
  readonly triggerReason: string;
  readonly occurredAt: Date;
  readonly source: string;
}

/**
 * {@link toSubscriptionTransferredAnalyticsInputs} for non-consumable one-time
 * purchases — emits the `$purchase.transferred_out` / `$purchase.transferred_in`
 * pair.
 */
export const toPurchaseTransferredAnalyticsInputs = (
  input: PurchaseTransferAnalyticsInput,
  cfg: RevenueAnalyticsMapperContext,
): ReadonlyArray<RevenuePurchaseTransferredOut | RevenuePurchaseTransferredIn> => {
  const properties = {
    fromDistinctId: input.fromDistinctId,
    fromPersonId: input.fromPersonId,
    paymentProviderConfigurationId: input.paymentProviderConfigurationId,
    paymentProviderConfigurationProductId: input.purchase.paymentProviderConfigurationProductId,
    providerEnvironment: input.purchase.providerEnvironment,
    providerEventType: "purchase.transferred",
    providerId: input.providerId,
    providerKey: input.purchase.providerKey,
    purchaseId: input.purchase.id,
    source: input.source,
    toDistinctId: input.toDistinctId,
    toPersonId: input.toPersonId,
    transferMode: input.transferMode,
    transferReason: input.triggerReason,
    transferredAt: input.occurredAt,
  };
  const transferredOut: RevenuePurchaseTransferredOut = {
    context: baseContext(),
    distinctId: input.fromDistinctId,
    eventId: deterministicAnalyticsEventId({
      anchor: cfg.idempotencyKey,
      eventName: "$purchase.transferred_out",
      personId: input.fromPersonId,
    }),
    eventName: "$purchase.transferred_out",
    occurredAt: input.occurredAt,
    organizationId: cfg.organizationId,
    personId: input.fromPersonId,
    projectId: cfg.projectId,
    properties,
    token: cfg.token,
    transactionId: null,
  };
  const transferredIn: RevenuePurchaseTransferredIn = {
    context: baseContext(),
    distinctId: input.toDistinctId,
    eventId: deterministicAnalyticsEventId({
      anchor: cfg.idempotencyKey,
      eventName: "$purchase.transferred_in",
      personId: input.toPersonId,
    }),
    eventName: "$purchase.transferred_in",
    occurredAt: input.occurredAt,
    organizationId: cfg.organizationId,
    personId: input.toPersonId,
    projectId: cfg.projectId,
    properties,
    token: cfg.token,
    transactionId: null,
  };
  return [transferredOut, transferredIn];
};
