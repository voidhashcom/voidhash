import { randomUUID } from "node:crypto";

/**
 * An in-memory stand-in for a payment provider Voidhash does not integrate
 * natively — think Paddle, Lemon Squeezy, or your own invoicing. It speaks in
 * the provider's own vocabulary (prices, payments, a hosted checkout page) so
 * `payment-source.ts` has something real-shaped to translate. Swap it for your
 * provider's API client; nothing else in the example depends on its internals.
 */

export type BillingPrice = {
  readonly id: string;
  readonly name: string;
  readonly amount: number;
  readonly currency: string;
  readonly interval: "month" | "year";
};

export type BillingSubscription = {
  readonly id: string;
  readonly buyerId: string;
  readonly customerId: string;
  readonly priceId: string;
  readonly status: "active" | "canceled";
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly cancelAtPeriodEnd: boolean;
  readonly canceledAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

type BillingMoneyMovement = {
  readonly id: string;
  readonly buyerId: string;
  readonly customerId: string;
  readonly priceId: string;
  /** Minor units of `currency`. */
  readonly amount: number;
  readonly currency: string;
  readonly createdAt: Date;
};

/** Money the buyer paid for one subscription period. */
export type BillingPayment = BillingMoneyMovement & {
  readonly kind: "payment";
  readonly subscriptionId: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
};

/** Money returned for an earlier payment. */
export type BillingRefund = BillingMoneyMovement & {
  readonly kind: "refund";
  /** The payment the refund returns money for. */
  readonly refundOf: string;
  readonly reason: string | null;
};

export type BillingCheckout = {
  readonly id: string;
  readonly priceId: string;
  readonly buyerId: string;
  readonly successUrl: string;
  readonly cancelUrl: string;
  readonly expiresAt: Date;
};

/** What the provider tells its webhook subscribers about. */
export type BillingEvent =
  | {
      readonly type: "payment.succeeded";
      readonly payment: BillingPayment;
      readonly subscription: BillingSubscription;
    }
  | { readonly type: "payment.refunded"; readonly refund: BillingRefund }
  | { readonly type: "subscription.updated"; readonly subscription: BillingSubscription };

/** A request the provider refuses; `payment-source.ts` maps it onto the protocol's codes. */
export class BillingError extends Error {
  readonly code: "not_found" | "invalid_request";

  constructor(code: "not_found" | "invalid_request", message: string) {
    super(message);
    this.name = "BillingError";
    this.code = code;
  }
}

export type Billing = ReturnType<typeof createBilling>;

const CHECKOUT_LIFETIME_MS = 60 * 60 * 1000;

const PRICES: ReadonlyArray<BillingPrice> = [
  { amount: 499, currency: "EUR", id: "pri_pro_monthly", interval: "month", name: "Pro monthly" },
  { amount: 4900, currency: "EUR", id: "pri_pro_yearly", interval: "year", name: "Pro yearly" },
];

const addInterval = (date: Date, interval: BillingPrice["interval"]): Date => {
  const next = new Date(date);
  if (interval === "month") next.setUTCMonth(next.getUTCMonth() + 1);
  else next.setUTCFullYear(next.getUTCFullYear() + 1);
  return next;
};

const newId = (prefix: string): string =>
  `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 16)}`;

/**
 * @param checkoutBaseUrl Where the hosted checkout page lives; this example
 *   serves it itself at `GET /billing/pay`.
 */
export const createBilling = (options: { readonly checkoutBaseUrl: string }) => {
  const subscriptions = new Map<string, BillingSubscription>();
  const payments = new Map<string, BillingPayment | BillingRefund>();
  const checkouts = new Map<string, BillingCheckout>();
  const listeners: Array<(event: BillingEvent) => void> = [];

  const emit = (event: BillingEvent): void => {
    for (const listener of listeners) listener(event);
  };

  const findPrice = (priceId: string): BillingPrice => {
    const price = PRICES.find((candidate) => candidate.id === priceId);
    if (price === undefined) throw new BillingError("not_found", `No price ${priceId}.`);
    return price;
  };

  return {
    prices: (): ReadonlyArray<BillingPrice> => PRICES,
    subscriptions: (): ReadonlyArray<BillingSubscription> => [...subscriptions.values()],
    payments: (): ReadonlyArray<BillingPayment | BillingRefund> => [...payments.values()],
    subscription: (id: string): BillingSubscription | undefined => subscriptions.get(id),

    /** Subscribes to provider events, the way a webhook endpoint would. */
    onEvent: (listener: (event: BillingEvent) => void): void => {
      listeners.push(listener);
    },

    openCheckout: (input: {
      readonly priceId: string;
      readonly buyerId: string;
      readonly successUrl: string;
      readonly cancelUrl: string;
    }): { readonly url: string; readonly expiresAt: Date } => {
      findPrice(input.priceId);
      const checkout: BillingCheckout = {
        ...input,
        expiresAt: new Date(Date.now() + CHECKOUT_LIFETIME_MS),
        id: newId("chk"),
      };
      checkouts.set(checkout.id, checkout);
      return {
        expiresAt: checkout.expiresAt,
        url: `${options.checkoutBaseUrl}?checkout=${checkout.id}`,
      };
    },

    /** The buyer paid on the hosted page: starts the subscription and books its first payment. */
    completeCheckout: (checkoutId: string): BillingCheckout => {
      const checkout = checkouts.get(checkoutId);
      if (checkout === undefined || checkout.expiresAt.getTime() < Date.now()) {
        throw new BillingError("not_found", `No open checkout ${checkoutId}.`);
      }
      checkouts.delete(checkoutId);

      const price = findPrice(checkout.priceId);
      const now = new Date();
      const subscription: BillingSubscription = {
        buyerId: checkout.buyerId,
        cancelAtPeriodEnd: false,
        canceledAt: null,
        createdAt: now,
        customerId: `cus_${checkout.buyerId}`,
        id: newId("sub"),
        periodEnd: addInterval(now, price.interval),
        periodStart: now,
        priceId: price.id,
        status: "active",
        updatedAt: now,
      };
      const payment: BillingPayment = {
        amount: price.amount,
        buyerId: subscription.buyerId,
        createdAt: now,
        currency: price.currency,
        customerId: subscription.customerId,
        id: newId("pay"),
        kind: "payment",
        periodEnd: subscription.periodEnd,
        periodStart: subscription.periodStart,
        priceId: price.id,
        subscriptionId: subscription.id,
      };
      subscriptions.set(subscription.id, subscription);
      payments.set(payment.id, payment);
      emit({ payment, subscription, type: "payment.succeeded" });
      return checkout;
    },

    cancel: (id: string, atPeriodEnd: boolean): BillingSubscription => {
      const current = subscriptions.get(id);
      if (current === undefined) throw new BillingError("not_found", `No subscription ${id}.`);

      const now = new Date();
      const subscription: BillingSubscription = atPeriodEnd
        ? { ...current, cancelAtPeriodEnd: true, updatedAt: now }
        : {
            ...current,
            cancelAtPeriodEnd: true,
            canceledAt: now,
            status: "canceled",
            updatedAt: now,
          };
      subscriptions.set(id, subscription);
      emit({ subscription, type: "subscription.updated" });
      return subscription;
    },

    /** Refunds `amount` minor units of a payment, or everything left of it when `null`. */
    refund: (paymentId: string, amount: number | null, reason: string | null): BillingRefund => {
      const payment = payments.get(paymentId);
      if (payment === undefined || payment.kind !== "payment") {
        throw new BillingError("not_found", `No payment ${paymentId}.`);
      }

      const refunded = [...payments.values()]
        .filter((candidate) => candidate.kind === "refund" && candidate.refundOf === paymentId)
        .reduce((sum, candidate) => sum + candidate.amount, 0);
      const left = payment.amount - refunded;
      const refundAmount = amount ?? left;
      if (refundAmount > left) {
        throw new BillingError(
          "invalid_request",
          `Only ${left} of payment ${paymentId} is left to refund.`,
        );
      }

      const refund: BillingRefund = {
        amount: refundAmount,
        buyerId: payment.buyerId,
        createdAt: new Date(),
        currency: payment.currency,
        customerId: payment.customerId,
        id: newId("rfd"),
        kind: "refund",
        priceId: payment.priceId,
        reason,
        refundOf: paymentId,
      };
      payments.set(refund.id, refund);
      emit({ refund, type: "payment.refunded" });
      return refund;
    },
  };
};
