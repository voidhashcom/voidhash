import {
  createEmptyNormalizedSchema,
  type NormalizedPaywallLocation,
  type NormalizedPerk,
  type NormalizedProduct,
  type NormalizedSchema,
  type ProviderId,
} from "../../src/domain/schema/normalized-schema";

/**
 * Create a test perk with optional overrides
 */
export function createTestPerk(overrides: Partial<NormalizedPerk> = {}): NormalizedPerk {
  return {
    name: "Test Perk",
    slug: "test-perk",
    ...overrides,
  };
}

/**
 * Create a test product with optional overrides
 */
export function createTestProduct(overrides: Partial<NormalizedProduct> = {}): NormalizedProduct {
  return {
    name: "Test Product",
    perks: [],
    providers: [],
    slug: "test-product",
    type: "subscription",
    ...overrides,
  };
}

/**
 * Create a test paywall location with optional overrides
 */
export function createTestPaywallLocation(
  overrides: Partial<NormalizedPaywallLocation> = {},
): NormalizedPaywallLocation {
  return {
    description: null,
    name: "Test Location",
    slug: "test-location",
    ...overrides,
  };
}

/**
 * Create a test schema with optional perks, products, and providers
 */
export function createTestSchema(
  options: {
    perks?: NormalizedPerk[];
    products?: NormalizedProduct[];
    locations?: NormalizedPaywallLocation[];
    enabledProviders?: ProviderId[];
  } = {},
): NormalizedSchema {
  const schema = createEmptyNormalizedSchema();

  for (const location of options.locations ?? []) {
    schema.locations.set(location.slug, location);
  }

  for (const perk of options.perks ?? []) {
    schema.perks.set(perk.slug, perk);
  }

  for (const product of options.products ?? []) {
    schema.products.set(product.slug, product);
  }

  for (const provider of options.enabledProviders ?? []) {
    schema.enabledProviders.add(provider);
  }

  return schema;
}

/**
 * Create a provider configuration for a product
 */
export function createProviderConfig(
  providerId: ProviderId,
  configuration: Record<string, unknown> = {},
): { providerId: ProviderId; configuration: Record<string, unknown> } {
  return {
    configuration,
    providerId,
  };
}
