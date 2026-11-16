/* oxlint-disable effect/prefer-option-over-null -- the inputs mirror the API's JSON fields, where null leaves a field unset; customers pass plain values. */
import type {
  PaymentSourceCustomer,
  PaymentSourceEnvironment,
  RecordPaymentSourceSubscriptionBodyStatus,
} from "@voidhash/generated-clients";

import type { GeneratedVoidhashNodeEffectClient } from "./internal/make-generated-client";

type PaymentSourcesGroup = GeneratedVoidhashNodeEffectClient["paymentSources"];

type TransactionEffect = ReturnType<PaymentSourcesGroup["upsertTransaction"]>;

type SubscriptionEffect = ReturnType<PaymentSourcesGroup["upsertSubscription"]>;

type CanceledSubscriptionEffect = ReturnType<PaymentSourcesGroup["cancelSubscription"]>;

type RefundedTransactionEffect = ReturnType<PaymentSourcesGroup["refundTransaction"]>;

/** Who paid: a distinct id your apps identify with, your provider's customer, or both. */
interface PaymentSourceBuyer {
  /** The distinct id the person is identified by in your apps. */
  readonly distinctId?: string | null;
  /** The payment provider's customer; resolves to the same person on every payment. */
  readonly customer?: PaymentSourceCustomer | null;
}

/** A payment for a product, in minor units of `currency`. */
export interface PaymentSourceChargeInput extends PaymentSourceBuyer {
  /** The product key the payment is for, as mapped to a Voidhash product. */
  readonly productKey: string;
  /** Integer amount in minor units, for example `4900` for 49.00 EUR. */
  readonly amount: number;
  /** ISO 4217 currency code. */
  readonly currency: string;
  /** The provider's commission, in minor units. */
  readonly fee?: number | null;
  /** Tax included in `amount`, in minor units. */
  readonly tax?: number | null;
  readonly occurredAt: Date;
  /** The provider's subscription id when the charge pays for a subscription period. */
  readonly subscriptionId?: string | null;
  /** Start of the subscription period the charge pays for. */
  readonly periodStart?: Date | null;
  /** End of the subscription period the charge pays for. */
  readonly periodEnd?: Date | null;
  /** Defaults to `"production"`. */
  readonly environment?: PaymentSourceEnvironment | null;
}

/** Money returned for an earlier charge, in minor units of the charge's currency. */
export interface PaymentSourceRefundInput extends PaymentSourceBuyer {
  /** The id the refunded charge was recorded under. */
  readonly refundsTransactionId: string;
  readonly amount: number;
  readonly currency: string;
  readonly productKey?: string | null;
  readonly fee?: number | null;
  readonly tax?: number | null;
  readonly occurredAt: Date;
  /** Defaults to `"production"`. */
  readonly environment?: PaymentSourceEnvironment | null;
}

/** A subscription's latest state. It carries no money; charges do. */
export interface PaymentSourceSubscriptionInput extends PaymentSourceBuyer {
  readonly productKey: string;
  readonly status: RecordPaymentSourceSubscriptionBodyStatus;
  readonly currentPeriodStart: Date;
  readonly currentPeriodEnd: Date;
  /** Whether the subscription renews at the end of the current period. */
  readonly isAutoRenewing: boolean;
  /** When access ended for a `canceled` subscription; defaults to `updatedAt`. */
  readonly canceledAt?: Date | null;
  /** When the provider last changed the subscription; older updates are ignored. */
  readonly updatedAt: Date;
  /** Defaults to `"production"`. */
  readonly environment?: PaymentSourceEnvironment | null;
}

/** How {@link VoidhashPaymentSourceEffectHandle.cancelSubscription} cancels. */
export interface PaymentSourceCancelSubscriptionOptions {
  /** End access now instead of when the current period ends. Defaults to `false`. */
  readonly isImmediate?: boolean;
}

/** What {@link VoidhashPaymentSourceEffectHandle.refundTransaction} returns to the buyer. */
export interface PaymentSourceRefundTransactionOptions {
  /** Minor units to refund; defaults to everything not yet refunded. */
  readonly amount?: number;
  /** Passed to the provider with the refund. */
  readonly reason?: string;
}

/**
 * Records payments and subscription state for one payment source. Ids are the
 * provider's own: recording the same id again with the same content returns
 * the recorded result, so retries are safe.
 */
export type VoidhashPaymentSourceEffectHandle = {
  /** Records a charge under the provider's transaction id. */
  readonly charge: (transactionId: string, charge: PaymentSourceChargeInput) => TransactionEffect;
  /** Records a refund under the provider's refund id. */
  readonly refund: (refundId: string, refund: PaymentSourceRefundInput) => TransactionEffect;
  /** Records the latest state of a subscription under the provider's subscription id. */
  readonly subscription: (
    subscriptionId: string,
    subscription: PaymentSourceSubscriptionInput,
  ) => SubscriptionEffect;
  /**
   * Asks the source's endpoint to cancel a subscription and records the state
   * it answers with. Needs an endpoint that implements `subscription.cancel`.
   */
  readonly cancelSubscription: (
    subscriptionId: string,
    options?: PaymentSourceCancelSubscriptionOptions,
  ) => CanceledSubscriptionEffect;
  /**
   * Asks the source's endpoint to refund a recorded charge and records the
   * refund it answers with. Needs an endpoint that implements
   * `transaction.refund`. To report a refund that already happened at the
   * provider, use {@link VoidhashPaymentSourceEffectHandle.refund}.
   */
  readonly refundTransaction: (
    transactionId: string,
    options?: PaymentSourceRefundTransactionOptions,
  ) => RefundedTransactionEffect;
};

const isoOrNull = (date?: Date | null): string | null | undefined =>
  date === undefined || date === null ? date : date.toISOString();

/**
 * Builds the handle `paymentSource(paymentProviderId)` returns over the
 * generated `paymentSources` group.
 */
export const makePaymentSource =
  (client: PaymentSourcesGroup) =>
  (paymentProviderId: string): VoidhashPaymentSourceEffectHandle => {
    // The provider's ids are free-form, and the generated client interpolates
    // path parameters as given, so they are encoded here.
    const params = (externalId: string) => ({
      externalId: encodeURIComponent(externalId),
      paymentProviderId: encodeURIComponent(paymentProviderId),
    });

    return {
      cancelSubscription: (subscriptionId, options = {}) =>
        client.cancelSubscription({
          params: params(subscriptionId),
          payload: options,
        }),
      charge: (transactionId, charge) =>
        client.upsertTransaction({
          params: params(transactionId),
          payload: {
            ...charge,
            occurredAt: charge.occurredAt.toISOString(),
            periodEnd: isoOrNull(charge.periodEnd),
            periodStart: isoOrNull(charge.periodStart),
            type: "charge",
          },
        }),
      refundTransaction: (transactionId, options = {}) =>
        client.refundTransaction({
          params: params(transactionId),
          payload: options,
        }),
      refund: (refundId, refund) =>
        client.upsertTransaction({
          params: params(refundId),
          payload: { ...refund, occurredAt: refund.occurredAt.toISOString(), type: "refund" },
        }),
      subscription: (subscriptionId, subscription) =>
        client.upsertSubscription({
          params: params(subscriptionId),
          payload: {
            ...subscription,
            canceledAt: isoOrNull(subscription.canceledAt),
            currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
            currentPeriodStart: subscription.currentPeriodStart.toISOString(),
            updatedAt: subscription.updatedAt.toISOString(),
          },
        }),
    };
  };
