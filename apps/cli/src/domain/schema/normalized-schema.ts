import { Schema } from "effect";

// ========================================================
// Provider IDs
// ========================================================

export const ProviderId = Schema.Literal("appleAppStore", "googlePlay");
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
  configuration: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
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
// Complete Normalized Schema
// ========================================================

export interface NormalizedSchema {
  enabledProviders: Set<ProviderId>; // providers used in schema
  perks: Map<string, NormalizedPerk>; // keyed by slug
  products: Map<string, NormalizedProduct>; // keyed by slug
}

// ========================================================
// Helper to create empty schema
// ========================================================

export function createEmptyNormalizedSchema(): NormalizedSchema {
  return {
    enabledProviders: new Set(),
    perks: new Map(),
    products: new Map(),
  };
}
