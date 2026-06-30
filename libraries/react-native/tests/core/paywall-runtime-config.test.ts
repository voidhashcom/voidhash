import { SubscriptionProduct } from "../../src/core/entities/product";
import {
  buildPaywallRuntimeConfig,
  mapStoreIntervalToPeriod,
} from "../../src/core/paywalls/paywall-runtime-config";
import type { PaywallReleaseRuntime } from "../../src/core/paywalls/paywall-service";
import { describe, expect, it } from "../helpers/effect-vitest";

function makeSubscriptionProduct(overrides: {
  id: string;
  slug: string;
  displayName?: string;
  description?: string;
  displayPrice?: string;
  price?: number;
  currency?: string;
  interval?: string;
}): SubscriptionProduct {
  return new SubscriptionProduct(
    overrides.id,
    overrides.slug,
    overrides.displayName ?? "Name",
    overrides.description ?? "Description",
    overrides.displayName ?? "Display Name",
    overrides.displayPrice ?? "$9.99",
    overrides.price ?? 9.99,
    overrides.currency ?? "USD",
    "autoRenewable",
    "ios",
    overrides.interval ?? "month",
  );
}

function makeRuntime(overrides: Partial<PaywallReleaseRuntime> = {}): PaywallReleaseRuntime {
  return {
    contentHash: "abc123",
    productSlugs: ["yearly", "monthly"],
    variables: { accentColor: "#16a34a" },
    ...overrides,
  };
}

describe("mapStoreIntervalToPeriod", () => {
  it("maps ISO-8601 and keyword intervals to contract periods", () => {
    expect(mapStoreIntervalToPeriod("P1M")).toBe("month");
    expect(mapStoreIntervalToPeriod("p1y")).toBe("year");
    expect(mapStoreIntervalToPeriod("P1W")).toBe("week");
    expect(mapStoreIntervalToPeriod("P7D")).toBe("week");
    expect(mapStoreIntervalToPeriod("monthly")).toBe("month");
    expect(mapStoreIntervalToPeriod("annual")).toBe("year");
    expect(mapStoreIntervalToPeriod("lifetime")).toBe("lifetime");
  });

  it("returns undefined for unknown or missing intervals", () => {
    expect(mapStoreIntervalToPeriod(undefined)).toBeUndefined();
    expect(mapStoreIntervalToPeriod("")).toBeUndefined();
    expect(mapStoreIntervalToPeriod("P3M")).toBeUndefined();
    expect(mapStoreIntervalToPeriod("fortnightly")).toBeUndefined();
  });
});

describe("buildPaywallRuntimeConfig", () => {
  it("maps resolved products onto the contract §7.1 shape", () => {
    const config = buildPaywallRuntimeConfig({
      runtime: makeRuntime(),
      productsBySlug: {
        yearly: makeSubscriptionProduct({
          id: "store_yearly",
          slug: "yearly",
          displayName: "Yearly Pro",
          description: "Best value",
          displayPrice: "$59.99",
          price: 59.99,
          currency: "USD",
          interval: "year",
        }),
        monthly: makeSubscriptionProduct({
          id: "store_monthly",
          slug: "monthly",
          displayPrice: "$9.99",
          price: 9.99,
          interval: "month",
        }),
      },
      platform: "ios",
      locale: "en-US",
    });

    expect(config.products).toEqual([
      {
        id: "store_yearly",
        slug: "yearly",
        displayName: "Yearly Pro",
        description: "Best value",
        price: 59.99,
        priceString: "$59.99",
        currencyCode: "USD",
        period: "year",
        trialPeriod: undefined,
      },
      expect.objectContaining({
        id: "store_monthly",
        slug: "monthly",
        priceString: "$9.99",
        period: "month",
      }),
    ]);
    expect(config.variables).toEqual({ accentColor: "#16a34a" });
    expect(config.locale).toBe("en-US");
    expect(config.platform).toBe("ios");
    expect(config.defaultSelectedProductId).toBe("store_yearly");
  });

  it("skips slugs the store could not resolve and reports them", () => {
    const skipped: string[] = [];
    const config = buildPaywallRuntimeConfig({
      runtime: makeRuntime({ productSlugs: ["missing", "monthly", "unknown"] }),
      productsBySlug: {
        missing: null,
        monthly: makeSubscriptionProduct({
          id: "store_monthly",
          slug: "monthly",
        }),
      },
      platform: "android",
      locale: undefined,
      onSkippedProductSlug: (slug) => skipped.push(slug),
    });

    expect(skipped).toEqual(["missing", "unknown"]);
    expect(config.products.map((product) => product.id)).toEqual(["store_monthly"]);
    expect(config.defaultSelectedProductId).toBe("store_monthly");
  });

  it("still produces a config with an empty products list", () => {
    const config = buildPaywallRuntimeConfig({
      runtime: makeRuntime({ productSlugs: ["missing"] }),
      productsBySlug: { missing: null },
      platform: "unknown",
      locale: undefined,
    });

    expect(config.products).toEqual([]);
    expect(config.defaultSelectedProductId).toBeUndefined();
    expect(config.platform).toBeUndefined();
    expect(config.locale).toBeUndefined();
    expect(config.variables).toEqual({ accentColor: "#16a34a" });
  });

  it("omits empty description/currency and non-finite price", () => {
    const config = buildPaywallRuntimeConfig({
      runtime: makeRuntime({ productSlugs: ["monthly"] }),
      productsBySlug: {
        monthly: makeSubscriptionProduct({
          id: "store_monthly",
          slug: "monthly",
          description: "",
          currency: "",
          price: Number.NaN,
        }),
      },
      platform: "ios",
      locale: "en-US",
    });

    const [product] = config.products;
    expect(product?.description).toBeUndefined();
    expect(product?.currencyCode).toBeUndefined();
    expect(product?.price).toBeUndefined();
  });
});
