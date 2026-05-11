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
        slug: "monthly_sub",
        type: "subscription",
        properties: { name: "Monthly" },
        configuration: {
          perks: { "all-access": true },
          providers: {
            appleAppStore: { productId: "com.voidhash.monthly.ios" },
            googlePlay: { productId: "com.voidhash.monthly.android" },
          },
        },
      },
      yearly_sub: {
        slug: "yearly_sub",
        type: "subscription",
        properties: { name: "Yearly" },
        configuration: {
          perks: { "all-access": true },
          providers: {
            appleAppStore: { productId: "com.voidhash.yearly.ios" },
            googlePlay: {
              productId: "com.voidhash.yearly.android",
              basePlanId: "yearly-base",
            },
          },
        },
      },
    },
  };
}
