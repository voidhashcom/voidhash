import type {
  ProductPurchaseV2Type,
  SubscriptionPurchaseV2Type,
} from "@voidhash/google-play-server-sdk";
import { DateTime, Effect, Option } from "effect";

import { describe, expect, it } from "../../../testing/effect-vitest.ts";
import { GooglePlayPurchaseProcessingIdempotencyKeyDerivationError } from "./errors.ts";
import {
  type GooglePlayNormalizedPurchase,
  getGooglePlayPersonIdentifier,
  getGooglePlayPurchaseProcessingIdempotencyKey,
  googlePlayProviderProductKey,
  normalizeProductPurchaseV2,
  normalizeSubscriptionPurchaseV2,
} from "./helpers.ts";

/** Builds a minimal normalized purchase; every Option field defaults to none. */
/** Builds a `Date` from epoch milliseconds without the banned `new Date(ms)`. */
const fromEpochMillis = (millis: number): Date => DateTime.toDateUtc(DateTime.makeUnsafe(millis));

const purchase = (
  overrides: Partial<GooglePlayNormalizedPurchase> = {},
): GooglePlayNormalizedPurchase => ({
  acknowledgementState: Option.none(),
  autoRenewEnabled: false,
  basePlanId: Option.none(),
  currency: Option.none(),
  expiryTime: Option.none(),
  isTrial: false,
  kind: "subscription",
  linkedPurchaseToken: Option.none(),
  obfuscatedExternalAccountId: Option.none(),
  offerId: Option.none(),
  orderId: Option.none(),
  priceMinorUnits: Option.none(),
  productId: "product.monthly",
  purchaseToken: "token_abc",
  startTime: Option.none(),
  storefront: Option.none(),
  subscriptionState: Option.none(),
  ...overrides,
});

describe("googlePlayProviderProductKey", () => {
  it("returns the bare productId when no base plan is set", () => {
    expect(googlePlayProviderProductKey("premium", Option.none())).toBe("premium");
  });

  it("composes productId:basePlanId when a base plan is set", () => {
    expect(googlePlayProviderProductKey("premium", Option.some("monthly"))).toBe("premium:monthly");
  });
});

describe("getGooglePlayPersonIdentifier", () => {
  it("prefers obfuscatedExternalAccountId when present", () => {
    expect(
      getGooglePlayPersonIdentifier(
        purchase({
          obfuscatedExternalAccountId: Option.some("token_uuid"),
          orderId: Option.some("GPA.1"),
        }),
      ),
    ).toEqual(Option.some("token_uuid"));
  });

  it("falls back to orderId when the account token is absent", () => {
    expect(getGooglePlayPersonIdentifier(purchase({ orderId: Option.some("GPA.1") }))).toEqual(
      Option.some("GPA.1"),
    );
  });

  it("falls back to purchaseToken when nothing else is available", () => {
    expect(getGooglePlayPersonIdentifier(purchase({ purchaseToken: "tok" }))).toEqual(
      Option.some("tok"),
    );
  });
});

describe("getGooglePlayPurchaseProcessingIdempotencyKey", () => {
  const EXPIRES_MS = 1_707_998_400_000; // 2024-02-15T12:00:00Z

  it.effect("derives a purchase key from orderId (no date — orderId is per-charge unique)", () =>
    Effect.gen(function* () {
      const key = yield* getGooglePlayPurchaseProcessingIdempotencyKey({
        eventType: "purchase",
        purchase: purchase({ orderId: Option.some("GPA.0001") }),
      });
      expect(key).toBe("google:GPA.0001:purchase");
    }),
  );

  it.effect("derives renewal / one-time-purchase / refund keys from orderId", () =>
    Effect.gen(function* () {
      const renewal = yield* getGooglePlayPurchaseProcessingIdempotencyKey({
        eventType: "renewal",
        purchase: purchase({ orderId: Option.some("GPA.0002") }),
      });
      const oneTime = yield* getGooglePlayPurchaseProcessingIdempotencyKey({
        eventType: "one_time_purchase",
        purchase: purchase({ kind: "product", orderId: Option.some("GPA.0003") }),
      });
      const refund = yield* getGooglePlayPurchaseProcessingIdempotencyKey({
        eventType: "refund",
        purchase: purchase({ orderId: Option.some("GPA.0004") }),
      });
      expect(renewal).toBe("google:GPA.0002:renewal");
      expect(oneTime).toBe("google:GPA.0003:one_time_purchase");
      expect(refund).toBe("google:GPA.0004:refund");
    }),
  );

  it.effect("distinguishes purchase from renewal against the same order", () =>
    Effect.gen(function* () {
      const p = yield* getGooglePlayPurchaseProcessingIdempotencyKey({
        eventType: "purchase",
        purchase: purchase({ orderId: Option.some("GPA.same") }),
      });
      const r = yield* getGooglePlayPurchaseProcessingIdempotencyKey({
        eventType: "renewal",
        purchase: purchase({ orderId: Option.some("GPA.same") }),
      });
      expect(p).not.toBe(r);
    }),
  );

  it.effect("derives an expired key from purchaseToken + expiryTime", () =>
    Effect.gen(function* () {
      const key = yield* getGooglePlayPurchaseProcessingIdempotencyKey({
        eventType: "expired",
        purchase: purchase({ expiryTime: Option.some(fromEpochMillis(EXPIRES_MS)), purchaseToken: "tok" }),
      });
      expect(key).toBe(`google:tok:expired:${EXPIRES_MS}`);
    }),
  );

  it.effect("derives distinct lifecycle keys per period for the same series", () =>
    Effect.gen(function* () {
      const first = yield* getGooglePlayPurchaseProcessingIdempotencyKey({
        eventType: "canceled",
        purchase: purchase({ expiryTime: Option.some(fromEpochMillis(EXPIRES_MS)), purchaseToken: "tok" }),
      });
      const second = yield* getGooglePlayPurchaseProcessingIdempotencyKey({
        eventType: "canceled",
        purchase: purchase({
          expiryTime: Option.some(fromEpochMillis(EXPIRES_MS + 30 * 24 * 3_600_000)),
          purchaseToken: "tok",
        }),
      });
      expect(first).not.toBe(second);
    }),
  );

  it.effect("derives a revoke key from purchaseToken (no expiry required)", () =>
    Effect.gen(function* () {
      const key = yield* getGooglePlayPurchaseProcessingIdempotencyKey({
        eventType: "revoke",
        purchase: purchase({ purchaseToken: "tok_rev" }),
      });
      expect(key).toBe("google:tok_rev:revoke");
    }),
  );

  it.effect("is stable across two deliveries of the same logical lifecycle event", () =>
    Effect.gen(function* () {
      const a = yield* getGooglePlayPurchaseProcessingIdempotencyKey({
        eventType: "billing_retry",
        purchase: purchase({ expiryTime: Option.some(fromEpochMillis(EXPIRES_MS)), purchaseToken: "tok" }),
      });
      const b = yield* getGooglePlayPurchaseProcessingIdempotencyKey({
        eventType: "billing_retry",
        purchase: purchase({ expiryTime: Option.some(fromEpochMillis(EXPIRES_MS)), purchaseToken: "tok" }),
      });
      expect(a).toBe(b);
    }),
  );

  it.effect("fails when orderId is missing for a charge event", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        getGooglePlayPurchaseProcessingIdempotencyKey({
          eventType: "purchase",
          purchase: purchase({ purchaseToken: "tok_no_order" }),
        }),
      );
      expect(error).toBeInstanceOf(GooglePlayPurchaseProcessingIdempotencyKeyDerivationError);
      expect(error.missingField).toBe("orderId");
      expect(error.purchaseToken).toBe("tok_no_order");
    }),
  );

  it.effect("fails when expiryTime is missing for a lifecycle event", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        getGooglePlayPurchaseProcessingIdempotencyKey({
          eventType: "expired",
          purchase: purchase({ purchaseToken: "tok_no_expiry" }),
        }),
      );
      expect(error.missingField).toBe("expiryTime");
    }),
  );
});

describe("normalizeSubscriptionPurchaseV2", () => {
  const data: SubscriptionPurchaseV2Type = {
    acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
    externalAccountIdentifiers: { obfuscatedExternalAccountId: "acct_token" },
    latestOrderId: "GPA.RENEW.2",
    lineItems: [
      {
        autoRenewingPlan: { autoRenewEnabled: true },
        expiryTime: "2024-03-15T12:00:00Z",
        offerDetails: { basePlanId: "monthly", offerId: "intro" },
        productId: "premium",
      },
    ],
    regionCode: "US",
    startTime: "2024-02-15T12:00:00Z",
    subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
  };

  it("maps line-item product, order, account token, dates, and offer flags", () => {
    const result = normalizeSubscriptionPurchaseV2({
      currency: Option.some("USD"),
      data,
      priceMinorUnits: Option.some(999),
      purchaseToken: "tok",
      subscriptionId: "premium",
    });
    expect(result.kind).toBe("subscription");
    expect(result.productId).toBe("premium");
    expect(result.orderId).toEqual(Option.some("GPA.RENEW.2"));
    expect(result.obfuscatedExternalAccountId).toEqual(Option.some("acct_token"));
    expect(result.storefront).toEqual(Option.some("US"));
    expect(result.basePlanId).toEqual(Option.some("monthly"));
    expect(result.offerId).toEqual(Option.some("intro"));
    expect(result.autoRenewEnabled).toBe(true);
    // An applied offer is conservatively treated as a (potential) trial so the
    // initial purchase emits no revenue.
    expect(result.isTrial).toBe(true);
    expect(Option.isSome(result.expiryTime)).toBe(true);
    expect(result.priceMinorUnits).toEqual(Option.some(999));
  });

  it("falls back to subscriptionId when the line item has no productId", () => {
    const result = normalizeSubscriptionPurchaseV2({
      currency: Option.none(),
      data: { lineItems: [{}] },
      priceMinorUnits: Option.none(),
      purchaseToken: "tok",
      subscriptionId: "fallback.product",
    });
    expect(result.productId).toBe("fallback.product");
    expect(result.isTrial).toBe(false);
  });
});

describe("normalizeProductPurchaseV2", () => {
  it("maps a one-time product purchase", () => {
    const data: ProductPurchaseV2Type = {
      acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING",
      obfuscatedExternalAccountId: "acct_token",
      orderId: "GPA.ONETIME.1",
      productLineItem: [{ productId: "coins_100" }],
      purchaseCompletionTime: "2024-02-15T12:00:00Z",
      regionCode: "US",
    };
    const result = normalizeProductPurchaseV2({
      currency: Option.none(),
      data,
      priceMinorUnits: Option.none(),
      purchaseToken: "tok",
      sku: "coins_100",
    });
    expect(result.kind).toBe("product");
    expect(result.productId).toBe("coins_100");
    expect(result.orderId).toEqual(Option.some("GPA.ONETIME.1"));
    expect(result.obfuscatedExternalAccountId).toEqual(Option.some("acct_token"));
    expect(result.autoRenewEnabled).toBe(false);
    expect(Option.isNone(result.expiryTime)).toBe(true);
  });
});
