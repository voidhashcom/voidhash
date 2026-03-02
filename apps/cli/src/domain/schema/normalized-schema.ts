import { Schema } from "effect";

// ========================================================
// Provider IDs
// ========================================================

export const ProviderId = Schema.Literals(["appleAppStore", "googlePlay"]);
export type ProviderId = typeof ProviderId.Type;

// ========================================================
// Normalized Perk
// ========================================================

export const NormalizedPerkSchema = Schema.Struct({
  name: Schema.String,
  slug: Schema.String,
});
export type NormalizedPerk = typeof NormalizedPerkSchema.Type;

// ========================================================
// Provider Configuration for a product
// ========================================================

export const ProductProviderConfigSchema = Schema.Struct({
  configuration: Schema.Record(Schema.String, Schema.Unknown),
  providerId: ProviderId,
});
export type ProductProviderConfig = typeof ProductProviderConfigSchema.Type;

// ========================================================
// Normalized Product
// ========================================================

export const NormalizedProductSchema = Schema.Struct({
  name: Schema.String,
  perks: Schema.Array(Schema.String), // perk slugs
  providers: Schema.Array(ProductProviderConfigSchema),
  slug: Schema.String,
  type: Schema.Literal("subscription"), // Extensible later
});
export type NormalizedProduct = typeof NormalizedProductSchema.Type;

// ========================================================
// Normalized Paywall Location
// ========================================================

export const NormalizedPaywallLocationSchema = Schema.Struct({
  description: Schema.NullOr(Schema.String),
  name: Schema.String,
  slug: Schema.String,
});
export type NormalizedPaywallLocation = typeof NormalizedPaywallLocationSchema.Type;

// ========================================================
// Complete Normalized Schema
// ========================================================

export interface NormalizedSchema {
  enabledProviders: Set<ProviderId>; // providers used in schema
  locations: Map<string, NormalizedPaywallLocation>; // keyed by slug
  perks: Map<string, NormalizedPerk>; // keyed by slug
  products: Map<string, NormalizedProduct>; // keyed by slug
}

// ========================================================
// Helper to create empty schema
// ========================================================

export function createEmptyNormalizedSchema(): NormalizedSchema {
  return {
    enabledProviders: new Set(),
    locations: new Map(),
    perks: new Map(),
    products: new Map(),
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
    enabledProviders: new Set(),
    locations: new Map(),
    perks: new Map([["all-access", { slug: "all-access", name: "All Access" }]]),
    products: new Map([
      [
        "monthly_sub",
        {
          slug: "monthly_sub",
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
          name: "Yearly",
          type: "subscription",
          perks: ["all-access"],
          providers: [],
        },
      ],
    ]),
  };
}
