/**
 * Pure unit tests for the Stripe data-shape helpers. None touch the DB or the
 * Stripe API; they operate on already-decoded event-object subsets. The only
 * Effect-returning helper here is `getStripeIdempotencyKey`, run through
 * `Effect.runSync` / `Effect.flip` for the success / failure branches.
 */
import { Effect } from "effect";

import { describe, expect, it } from "vite-plus/test";

import { ProviderEnvironment } from "@voidhash/db";

import { StripePurchaseProcessingIdempotencyKeyDerivationError } from "./errors.ts";
import {
  buildStripeWebhookAnonymousDistinctId,
  extractStripeDistinctId,
  getStripeIdempotencyKey,
  invoicePrimaryPriceProduct,
  invoiceTaxMinor,
  isPaidOneTimeCheckout,
  resolveChargeKey,
  stripeProviderProductKey,
  subscriptionPrimaryPriceProduct,
} from "./helpers.ts";
import type { StripeCheckoutSession, StripeInvoice, StripeSubscription } from "./events.ts";

describe("getStripeIdempotencyKey", () => {
  it("derives the key from a present anchor id", () => {
    const key = Effect.runSync(
      getStripeIdempotencyKey({
        anchorField: "invoice.id",
        anchorId: "in_123",
        eventType: "purchase",
      }),
    );
    expect(key).toBe("stripe:in_123:purchase");
  });

  it("appends extra parts to the key", () => {
    const key = Effect.runSync(
      getStripeIdempotencyKey({
        anchorField: "invoice.id",
        anchorId: "in_123",
        eventType: "billing_retry",
        extra: [3],
      }),
    );
    expect(key).toBe("stripe:in_123:billing_retry:3");
  });

  it.each([undefined, null, ""])(
    "fails with the derivation error when the anchor id is missing (%p)",
    (anchorId) => {
      const error = Effect.runSync(
        Effect.flip(
          getStripeIdempotencyKey({
            anchorField: "invoice.id",
            anchorId,
            eventType: "purchase",
          }),
        ),
      );
      expect(error instanceof StripePurchaseProcessingIdempotencyKeyDerivationError).toBe(true);
      expect(error.eventType).toBe("purchase");
      expect(error.missingField).toBe("invoice.id");
    },
  );
});

describe("stripeProviderProductKey", () => {
  it("joins product id and price id", () => {
    expect(stripeProviderProductKey({ priceId: "price_b", productId: "prod_a" })).toBe(
      "prod_a:price_b",
    );
  });

  it("returns undefined when either id is missing", () => {
    expect(stripeProviderProductKey({ priceId: "price_b" })).toBeUndefined();
    expect(stripeProviderProductKey({ productId: "prod_a" })).toBeUndefined();
    expect(stripeProviderProductKey({})).toBeUndefined();
  });
});

describe("invoicePrimaryPriceProduct", () => {
  it("returns the first line's price + product", () => {
    const invoice = {
      lines: { data: [{ price: { id: "price_b", product: "prod_a" } }] },
    } as StripeInvoice;
    expect(invoicePrimaryPriceProduct(invoice)).toEqual({
      priceId: "price_b",
      productId: "prod_a",
    });
  });

  it("returns undefined when no line carries a price", () => {
    expect(invoicePrimaryPriceProduct({ lines: { data: [] } } as StripeInvoice)).toBeUndefined();
    expect(invoicePrimaryPriceProduct({} as StripeInvoice)).toBeUndefined();
  });
});

describe("subscriptionPrimaryPriceProduct", () => {
  it("returns the first item's price + product", () => {
    const subscription = {
      items: { data: [{ price: { id: "price_b", product: "prod_a" } }] },
    } as StripeSubscription;
    expect(subscriptionPrimaryPriceProduct(subscription)).toEqual({
      priceId: "price_b",
      productId: "prod_a",
    });
  });

  it("returns undefined when no item carries a price", () => {
    expect(
      subscriptionPrimaryPriceProduct({ items: { data: [] } } as StripeSubscription),
    ).toBeUndefined();
  });
});

describe("invoiceTaxMinor", () => {
  it("reads the legacy `tax` field", () => {
    expect(invoiceTaxMinor({ tax: 42 } as StripeInvoice)).toBe(42);
  });

  it("sums the `total_taxes` array when `tax` is absent", () => {
    const invoice = {
      total_taxes: [{ amount: 10 }, { amount: 32 }],
    } as StripeInvoice;
    expect(invoiceTaxMinor(invoice)).toBe(42);
  });

  it("returns 0 when neither is present", () => {
    expect(invoiceTaxMinor({} as StripeInvoice)).toBe(0);
  });
});

describe("resolveChargeKey", () => {
  it("prefers payment_intent over charge over id", () => {
    expect(resolveChargeKey({ charge: "ch_1", id: "x", payment_intent: "pi_1" })).toBe("pi_1");
  });

  it("falls back to charge when payment_intent is absent", () => {
    expect(resolveChargeKey({ charge: "ch_1", id: "x" })).toBe("ch_1");
  });

  it("falls back to id when both are absent", () => {
    expect(resolveChargeKey({ id: "x" })).toBe("x");
  });
});

describe("extractStripeDistinctId", () => {
  it("prefers client_reference_id", () => {
    expect(
      extractStripeDistinctId({
        client_reference_id: "ref_1",
        metadata: { voidhash_distinct_id: "meta_1" },
      }),
    ).toBe("ref_1");
  });

  it("falls back to metadata.voidhash_distinct_id", () => {
    expect(extractStripeDistinctId({ metadata: { voidhash_distinct_id: "meta_1" } })).toBe(
      "meta_1",
    );
  });

  it("falls back to subscription_details.metadata.voidhash_distinct_id", () => {
    expect(
      extractStripeDistinctId({
        subscription_details: { metadata: { voidhash_distinct_id: "sub_1" } },
      }),
    ).toBe("sub_1");
  });

  it("returns undefined when no distinctId was stamped", () => {
    expect(extractStripeDistinctId({})).toBeUndefined();
  });
});

describe("buildStripeWebhookAnonymousDistinctId", () => {
  it("encodes provider, environment, and customer for production", () => {
    const id = buildStripeWebhookAnonymousDistinctId({
      customerId: "cus_1",
      providerEnvironment: ProviderEnvironment.Production,
    });
    expect(id).toContain("provider:stripe:");
    expect(id).toContain("production");
    expect(id).toContain("cus_1");
  });

  it("uses the sandbox label for the sandbox environment", () => {
    const id = buildStripeWebhookAnonymousDistinctId({
      customerId: "cus_1",
      providerEnvironment: ProviderEnvironment.Sandbox,
    });
    expect(id).toContain("provider:stripe:");
    expect(id).toContain("sandbox");
    expect(id).toContain("cus_1");
  });
});

describe("isPaidOneTimeCheckout", () => {
  it("is true for a paid payment-mode session", () => {
    expect(
      isPaidOneTimeCheckout({
        mode: "payment",
        payment_status: "paid",
      } as StripeCheckoutSession),
    ).toBe(true);
  });

  it("is false for a subscription-mode session", () => {
    expect(
      isPaidOneTimeCheckout({
        mode: "subscription",
        payment_status: "paid",
      } as StripeCheckoutSession),
    ).toBe(false);
  });

  it("is false when the payment is not yet paid", () => {
    expect(
      isPaidOneTimeCheckout({
        mode: "payment",
        payment_status: "unpaid",
      } as StripeCheckoutSession),
    ).toBe(false);
  });
});
