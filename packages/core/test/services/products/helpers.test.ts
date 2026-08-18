import { constant } from "@voidhash/lib/lang";
import { describe, expect, it } from "vite-plus/test";
import {
  ProductType,
  SubscriptionDuration,
  type ProductTypeValue,
  type SubscriptionDurationValue,
} from "@voidhash/lib";

import {
  dbProductTypeToLabel,
  dbSubscriptionDurationToLabel,
} from "../../../src/services/products/helpers.ts";

/**
 * Simulates a corrupt/unknown DB value reaching the exhaustiveness guard: the
 * numbers below are deliberately outside the `ProductType` union.
 */
const corruptProductType = (value: any): ProductTypeValue => value;

describe("dbProductTypeToLabel", () => {
  it.each(
    constant([
      [ProductType.Subscription, "subscription"],
      [ProductType.OneTime, "one-time"],
      [ProductType.OneTimeConsumable, "one-time-consumable"],
    ]),
  )("maps ProductType %d to its public label %s", (type, label) => {
    expect(dbProductTypeToLabel(type)).toBe(label);
  });

  it("returns 'subscription' for ProductType.Subscription", () => {
    expect(dbProductTypeToLabel(ProductType.Subscription)).toBe("subscription");
  });

  it("returns 'one-time' for ProductType.OneTime", () => {
    expect(dbProductTypeToLabel(ProductType.OneTime)).toBe("one-time");
  });

  it("returns 'one-time-consumable' for ProductType.OneTimeConsumable", () => {
    expect(dbProductTypeToLabel(ProductType.OneTimeConsumable)).toBe("one-time-consumable");
  });

  it("throws for an out-of-range product type value", () => {
    expect(() => dbProductTypeToLabel(corruptProductType(99))).toThrow("Invalid product type: 99");
  });

  it("throws for a zero product type value", () => {
    expect(() => dbProductTypeToLabel(corruptProductType(0))).toThrow("Invalid product type: 0");
  });
});

describe("dbSubscriptionDurationToLabel", () => {
  it.each([
    [SubscriptionDuration.Weekly, "weekly"],
    [SubscriptionDuration.Monthly, "monthly"],
    [SubscriptionDuration.Quarterly, "quarterly"],
    [SubscriptionDuration.SemiAnnual, "semi-annual"],
    [SubscriptionDuration.Annual, "annual"],
    [null, null],
  ] satisfies ReadonlyArray<readonly [SubscriptionDurationValue | null, string | null]>)(
    "maps duration %s to %s",
    (duration, label) => {
      expect(dbSubscriptionDurationToLabel(duration)).toBe(label);
    },
  );
});
