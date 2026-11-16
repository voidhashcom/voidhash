import type {
  PaymentSourceChargeInput,
  PaymentSourceRefundInput,
  VoidhashNodeClient,
  VoidhashPaymentSourceHandle,
} from "@voidhash/node";
import {
  defineProvider,
  ProviderError,
  type ProviderSubscription,
  type ProviderTransaction,
  type VoidhashProvider,
} from "@voidhash/node/providers";

import {
  BillingError,
  type Billing,
  type BillingEvent,
  type BillingPayment,
  type BillingRefund,
  type BillingSubscription,
} from "./billing";

/**
 * Connects the payment provider in `billing.ts` to Voidhash as a payment
 * source. Two directions, both keyed by the provider's own ids so either side
 * can repeat itself safely:
 *
 * - **Push.** {@link createBillingEventHandler} reports every payment, refund
 *   and subscription change the provider announces.
 * - **Pull.** {@link createPaymentSourceEndpoint} answers what Voidhash asks
 *   the provider: its catalog and history for the import, one subscription's
 *   state, and the cancellations and refunds Voidhash starts.
 */

const PAGE_SIZE = 100;

// The provider's vocabulary → the payment source's. These are the only places
// that know both.

const toSubscription = (subscription: BillingSubscription): ProviderSubscription => ({
  canceledAt: subscription.canceledAt,
  currentPeriodEnd: subscription.periodEnd,
  currentPeriodStart: subscription.periodStart,
  customer: { externalId: subscription.customerId },
  distinctId: subscription.buyerId,
  id: subscription.id,
  productKey: subscription.priceId,
  status: subscription.status,
  updatedAt: subscription.updatedAt,
  willRenew: subscription.status === "active" && !subscription.cancelAtPeriodEnd,
});

const toCharge = (payment: BillingPayment): PaymentSourceChargeInput => ({
  amount: payment.amount,
  currency: payment.currency,
  customer: { externalId: payment.customerId },
  distinctId: payment.buyerId,
  occurredAt: payment.createdAt,
  periodEnd: payment.periodEnd,
  periodStart: payment.periodStart,
  productKey: payment.priceId,
  subscriptionId: payment.subscriptionId,
});

const toRefund = (refund: BillingRefund): PaymentSourceRefundInput => ({
  amount: refund.amount,
  currency: refund.currency,
  occurredAt: refund.createdAt,
  refundsTransactionId: refund.refundOf,
});

const toTransaction = (payment: BillingPayment | BillingRefund): ProviderTransaction =>
  payment.kind === "payment"
    ? { ...toCharge(payment), id: payment.id, type: "charge" }
    : { ...toRefund(payment), id: payment.id, type: "refund" };

/** One page of `items`, with the offset of the next page as its cursor. */
const page = <T>(items: ReadonlyArray<T>, cursor: string | null) => {
  const offset = cursor === null ? 0 : Number(cursor);
  const next = offset + PAGE_SIZE;
  return {
    items: items.slice(offset, next),
    nextCursor: next < items.length ? String(next) : null,
  };
};

/** Runs a provider call, turning its refusals into the protocol's error codes. */
const callBilling = <T>(call: () => T): T => {
  try {
    return call();
  } catch (error) {
    if (error instanceof BillingError) throw new ProviderError(error.code, error.message);
    throw error;
  }
};

/**
 * The endpoint Voidhash calls, mounted at `POST /voidhash/provider`. Enter its
 * public HTTPS URL on the payment source in Studio and copy the signing secret
 * it shows into `VOIDHASH_PROVIDER_SECRET`.
 *
 * Operations you leave out are answered `unsupported_operation`, and Studio
 * hides the matching actions. A real provider client would also look at
 * `context.environment` and use the provider's test mode for `"test"`.
 */
export const createPaymentSourceEndpoint = (options: {
  readonly billing: Billing;
  readonly source: string;
  readonly signingSecret: string;
}): VoidhashProvider => {
  const { billing } = options;

  return defineProvider({
    catalog: {
      list: ({ cursor }) =>
        page(
          billing
            .prices()
            .map((price) => ({ key: price.id, kind: "subscription", name: price.name })),
          cursor,
        ),
    },
    history: {
      list: ({ before, cursor, kind }) =>
        kind === "subscriptions"
          ? page(
              billing
                .subscriptions()
                .filter((subscription) => subscription.createdAt < before)
                .map(toSubscription),
              cursor,
            )
          : page(
              billing
                .payments()
                .filter((payment) => payment.createdAt < before)
                .map(toTransaction),
              cursor,
            ),
    },
    signingSecret: options.signingSecret,
    source: options.source,
    subscriptions: {
      cancel: ({ atPeriodEnd, id }) => ({
        subscription: toSubscription(callBilling(() => billing.cancel(id, atPeriodEnd))),
      }),
      get: ({ id }) => {
        const subscription = billing.subscription(id);
        return { subscription: subscription === undefined ? null : toSubscription(subscription) };
      },
    },
    transactions: {
      refund: ({ amount, reason, transactionId }) => {
        const refund = callBilling(() => billing.refund(transactionId, amount, reason));
        return { refund: { ...toRefund(refund), id: refund.id, type: "refund" } };
      },
    },
  });
};

/**
 * The payment provider id of the payment source with `slug`. The API names a
 * source by its id; the slug is the source's `key`, which a lookup resolves.
 */
const findPaymentSourceId = async (
  voidhash: VoidhashNodeClient,
  slug: string,
  cursor?: string,
): Promise<string> => {
  const page = await voidhash.paymentProviders.list({
    params: { cursor, type: "payment_source" },
  });
  const source = page.data.find((provider) => provider.key === slug);
  if (source !== undefined) return source.id;
  if (!page.pageInfo.hasNextPage || page.pageInfo.endCursor === null) {
    throw new Error(`This project has no payment source "${slug}"; create it in Studio.`);
  }
  return findPaymentSourceId(voidhash, slug, page.pageInfo.endCursor);
};

/**
 * Where the provider's webhooks land: reports each event to Voidhash through
 * the payment source. A real provider calls you over HTTP — verify its
 * signature on the raw body first, as `routes/webhook.ts` does for Voidhash.
 *
 * A charge goes before the subscription's state: the charge opens the paid
 * period, and the state then decides renewal. Cancellations and refunds that
 * Voidhash started come back through here too; reporting them again under the
 * same id records nothing new.
 */
export const createBillingEventHandler = (options: {
  readonly voidhash: VoidhashNodeClient;
  readonly source: string;
}) => {
  // Looked up on the first event and kept; cleared on failure so a network
  // blip does not poison every later report.
  let sourcePromise: Promise<VoidhashPaymentSourceHandle> | undefined;
  const paymentSource = (): Promise<VoidhashPaymentSourceHandle> => {
    sourcePromise ??= findPaymentSourceId(options.voidhash, options.source).then(
      (paymentProviderId) => options.voidhash.paymentSource(paymentProviderId),
      (error: unknown) => {
        sourcePromise = undefined;
        throw error;
      },
    );
    return sourcePromise;
  };

  // The endpoint protocol says `willRenew` where the API says `isAutoRenewing`.
  const toReported = ({ id, willRenew, ...subscription }: ProviderSubscription) => ({
    id,
    state: { ...subscription, isAutoRenewing: willRenew },
  });

  return async (event: BillingEvent): Promise<void> => {
    const source = await paymentSource();
    switch (event.type) {
      case "payment.succeeded": {
        const { id, state } = toReported(toSubscription(event.subscription));
        await source.charge(event.payment.id, toCharge(event.payment));
        await source.subscription(id, state);
        return;
      }
      case "payment.refunded":
        await source.refund(event.refund.id, toRefund(event.refund));
        return;
      case "subscription.updated": {
        const { id, state } = toReported(toSubscription(event.subscription));
        await source.subscription(id, state);
        return;
      }
    }
  };
};
