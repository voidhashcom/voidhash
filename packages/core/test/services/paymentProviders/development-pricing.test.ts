import { ProductType, SubscriptionDuration, type SubscriptionDurationValue } from "@voidhash/lib";
import { DateTime } from "effect";
import { describe, expect, it } from "vite-plus/test";

import {
  DEVELOPMENT_PRICES,
  addDevelopmentBillingPeriod,
  getDevelopmentPrice,
  type DevelopmentPrice,
} from "../../../src/services/paymentProviders/development/pricing.ts";

describe("development pricing", () => {
  it.each([
    [SubscriptionDuration.Weekly, DEVELOPMENT_PRICES.weekly, "week", 1],
    [SubscriptionDuration.Monthly, DEVELOPMENT_PRICES.monthly, "month", 1],
    [SubscriptionDuration.Quarterly, DEVELOPMENT_PRICES.quarterly, "month", 3],
    [SubscriptionDuration.SemiAnnual, DEVELOPMENT_PRICES.semiAnnual, "month", 6],
    [SubscriptionDuration.Annual, DEVELOPMENT_PRICES.annual, "year", 1],
  ] satisfies ReadonlyArray<
    readonly [SubscriptionDurationValue, number, DevelopmentPrice["period"], number]
  >)(
    "maps subscription duration %d to %d minor units and a %s period",
    (duration, amount, period, periodCount) => {
      expect(getDevelopmentPrice(ProductType.Subscription, duration)).toMatchObject({
        amount,
        currencyCode: "USD",
        period,
        periodCount,
        warning: null,
      });
    },
  );

  it("uses stable one-time and consumable prices", () => {
    expect(getDevelopmentPrice(ProductType.OneTime, null).amount).toBe(DEVELOPMENT_PRICES.oneTime);
    expect(getDevelopmentPrice(ProductType.OneTimeConsumable, null).amount).toBe(
      DEVELOPMENT_PRICES.consumable,
    );
  });

  it("falls legacy subscriptions back to monthly with a warning", () => {
    expect(getDevelopmentPrice(ProductType.Subscription, null)).toMatchObject({
      amount: DEVELOPMENT_PRICES.monthly,
      duration: "monthly",
      period: "month",
      periodCount: 1,
      warning: expect.stringContaining("simulated as monthly"),
    });
  });

  it("advances subscription expiry using the inferred calendar period", () => {
    const purchasedAt = DateTime.toDateUtc(DateTime.makeUnsafe("2026-08-18T12:00:00.000Z"));

    expect(
      addDevelopmentBillingPeriod(
        purchasedAt,
        getDevelopmentPrice(ProductType.Subscription, SubscriptionDuration.Weekly),
      ).toISOString(),
    ).toBe("2026-08-25T12:00:00.000Z");
    expect(
      addDevelopmentBillingPeriod(
        purchasedAt,
        getDevelopmentPrice(ProductType.Subscription, SubscriptionDuration.Quarterly),
      ).toISOString(),
    ).toBe("2026-11-18T12:00:00.000Z");
    expect(
      addDevelopmentBillingPeriod(
        purchasedAt,
        getDevelopmentPrice(ProductType.Subscription, SubscriptionDuration.Annual),
      ).toISOString(),
    ).toBe("2027-08-18T12:00:00.000Z");
  });
});
