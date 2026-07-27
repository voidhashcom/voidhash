import { describe, expect, it } from "vite-plus/test";
import { ProductType, type ProductTypeValue } from "@voidhash/lib";

import { dbProductTypeToLabel } from "../../../src/services/products/helpers.ts";

describe("dbProductTypeToLabel", () => {
  it.each([
    [ProductType.Subscription, "subscription"],
    [ProductType.OneTime, "one-time"],
    [ProductType.OneTimeConsumable, "one-time-consumable"],
  ] as const)("maps ProductType %d to its public label %s", (type, label) => {
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
    // 99 is not a member of the ProductType union; the cast simulates a
    // corrupt/unknown DB value reaching the exhaustiveness guard.
    expect(() => dbProductTypeToLabel(99 as ProductTypeValue)).toThrow("Invalid product type: 99");
  });

  it("throws for a zero product type value", () => {
    expect(() => dbProductTypeToLabel(0 as ProductTypeValue)).toThrow("Invalid product type: 0");
  });
});
