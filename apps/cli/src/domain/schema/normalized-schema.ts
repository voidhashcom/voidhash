import * as Schema from "effect/Schema";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";

// ========================================================
// Provider IDs
// ========================================================

export const ProviderId = Schema.Literals(["appleAppStore", "googlePlay"]);
export type ProviderId = typeof ProviderId.Type;

// ========================================================
// Normalized Perk
// ========================================================

export const NormalizedPerk = Schema.Struct({
  name: Schema.String,
  slug: Schema.String,
});
export type NormalizedPerk = typeof NormalizedPerk.Type;

// ========================================================
// Provider Configuration for a product
// ========================================================

export const ProductProviderConfig = Schema.Struct({
  configuration: Schema.Record(Schema.String, Schema.Unknown),
  providerId: ProviderId,
});
export type ProductProviderConfig = typeof ProductProviderConfig.Type;

// ========================================================
// Normalized Product
// ========================================================

export const NormalizedProduct = Schema.Struct({
  duration: Schema.NullOr(
    Schema.Literals(["weekly", "monthly", "quarterly", "semi-annual", "annual"]),
  ),
  name: Schema.String,
  perks: Schema.Array(Schema.String), // perk slugs
  providers: Schema.Array(ProductProviderConfig),
  slug: Schema.String,
  type: Schema.Literals(["subscription", "one-time", "one-time-consumable"]),
});
export type NormalizedProduct = typeof NormalizedProduct.Type;

// ========================================================
// Normalized Paywall Location
// ========================================================

export const NormalizedPaywallLocation = Schema.Struct({
  description: Schema.NullOr(Schema.String),
  name: Schema.String,
  slug: Schema.String,
});
export type NormalizedPaywallLocation = typeof NormalizedPaywallLocation.Type;

// ========================================================
// Complete Normalized Schema
// ========================================================

export interface NormalizedSchema {
  enabledProviders: MutableHashSet.MutableHashSet<ProviderId>; // providers used in schema
  locations: MutableHashMap.MutableHashMap<string, NormalizedPaywallLocation>; // keyed by slug
  perks: MutableHashMap.MutableHashMap<string, NormalizedPerk>; // keyed by slug
  products: MutableHashMap.MutableHashMap<string, NormalizedProduct>; // keyed by slug
}

// ========================================================
// Helper to create empty schema
// ========================================================

export function createEmptyNormalizedSchema(): NormalizedSchema {
  return {
    enabledProviders: MutableHashSet.empty(),
    locations: MutableHashMap.empty(),
    perks: MutableHashMap.empty(),
    products: MutableHashMap.empty(),
  };
}

/**
 * Create an initial schema with a starter template:
 * - One "all-access" perk
 * - Two subscription products (monthly and yearly)
 * - No providers configured
 */
export function createInitialNormalizedSchema(): NormalizedSchema {
  return {
    enabledProviders: MutableHashSet.empty(),
    locations: MutableHashMap.empty(),
    perks: MutableHashMap.make(["all-access", { slug: "all-access", name: "All Access" }]),
    products: MutableHashMap.fromIterable<string, NormalizedProduct>([
      [
        "monthly_sub",
        {
          slug: "monthly_sub",
          duration: "monthly",
          name: "Monthly",
          type: "subscription",
          perks: ["all-access"],
          providers: [],
        },
      ],
      [
        "yearly_sub",
        {
          slug: "yearly_sub",
          duration: "annual",
          name: "Yearly",
          type: "subscription",
          perks: ["all-access"],
          providers: [],
        },
      ],
    ]),
  };
}
