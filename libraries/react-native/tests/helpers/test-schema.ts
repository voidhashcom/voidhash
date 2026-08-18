import type { RuntimeSchema } from "../../src/core/schema/runtime";

/**
 * Build a deterministic in-memory schema for tests. Mirrors the shape the
 * SDK fetches from the server at init time so tests don't need a live
 * backend to exercise product / purchase flows.
 */
export function createTestSchema(): RuntimeSchema {
  return {
    version: "sha256:test",
    perks: {
      "all-access": { slug: "all-access", name: "All Access" },
    },
    locations: {},
    products: {
      monthly_sub: {
        duration: "monthly",
        id: "prod_monthly",
        slug: "monthly_sub",
        type: "subscription",
        properties: { name: "Monthly" },
        configuration: {
          perks: { "all-access": true },
          providers: {
            appleAppStore: { productId: "com.voidhash.monthly.ios" },
            development: {
              currencyCode: "USD",
              duration: "monthly",
              period: "month",
              periodCount: 1,
              price: 9.99,
              priceInMinorUnits: 999,
              productId: "monthly_sub",
              warning: null,
            },
            googlePlay: { productId: "com.voidhash.monthly.android" },
          },
        },
      },
      yearly_sub: {
        duration: "annual",
        id: "prod_yearly",
        slug: "yearly_sub",
        type: "subscription",
        properties: { name: "Yearly" },
        configuration: {
          perks: { "all-access": true },
          providers: {
            appleAppStore: { productId: "com.voidhash.yearly.ios" },
            development: {
              currencyCode: "USD",
              duration: "annual",
              period: "year",
              periodCount: 1,
              price: 49.99,
              priceInMinorUnits: 4999,
              productId: "yearly_sub",
              warning: null,
            },
            googlePlay: {
              productId: "com.voidhash.yearly.android",
              basePlanId: "yearly-base",
            },
          },
        },
      },
      coins: {
        duration: null,
        id: "prod_coins",
        slug: "coins",
        type: "one-time-consumable",
        properties: { name: "Coins" },
        configuration: {
          perks: {},
          providers: {
            appleAppStore: { productId: "com.voidhash.coins.ios" },
            development: {
              currencyCode: "USD",
              duration: null,
              period: "lifetime",
              periodCount: 1,
              price: 4.99,
              priceInMinorUnits: 499,
              productId: "coins",
              warning: null,
            },
            googlePlay: { productId: "com.voidhash.coins.android" },
          },
        },
      },
    },
  };
}
