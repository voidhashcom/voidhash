import { ProductDefinition } from "./products/base";
import { PaywallLocationDefinition } from "./paywall-location";
import type {
  AnyPaywallLocationDefinition,
  AnySchemaConfiguration,
  ExtractSchemaConfigurations,
  ExtractSchemaPaywallLocationDefinitions,
  ExtractSchemaProductDefinitions,
  VoidhashSchema,
} from "./types";

export function extractProductDefinitions<TSchema extends VoidhashSchema>(
  schema: TSchema
): ExtractSchemaProductDefinitions<TSchema> {
  const productDefinitions = {} as ExtractSchemaProductDefinitions<TSchema>;

  for (const [key, value] of Object.entries(schema)) {
    if (value instanceof ProductDefinition) {
      // @ts-expect-error - TypeScript can't infer that key is a valid product key, but we know it is
      productDefinitions[key] = value;
    }
  }

  return productDefinitions;
}

export function extractPaywallLocationDefinitions<TSchema extends VoidhashSchema>(
  schema: TSchema
): ExtractSchemaPaywallLocationDefinitions<TSchema> {
  const paywallLocationDefinitions =
    {} as ExtractSchemaPaywallLocationDefinitions<TSchema>;

  for (const [key, value] of Object.entries(schema)) {
    if (value instanceof PaywallLocationDefinition) {
      // @ts-expect-error - TypeScript can't infer that key is a valid paywall location key, but we know it is
      paywallLocationDefinitions[key] = value as AnyPaywallLocationDefinition;
    }
  }

  return paywallLocationDefinitions;
}

/**
 * Extracts schema configuration objects from a schema module.
 * Schema configurations contain providers, perks, and product builder methods.
 */
export function extractSchemaConfigurations<TSchema extends VoidhashSchema>(
  schema: TSchema
): ExtractSchemaConfigurations<TSchema> {
  const configurations = {} as ExtractSchemaConfigurations<TSchema>;

  for (const [key, value] of Object.entries(schema)) {
    // Check if this is a schema configuration by looking for the required properties
    if (
      value &&
      typeof value === "object" &&
      "providers" in value &&
      "perks" in value &&
      "subscription" in value &&
      typeof value.subscription === "function" &&
      "location" in value &&
      typeof value.location === "function"
    ) {
      // @ts-expect-error - TypeScript can't infer that key is a valid configuration key, but we know it is
      configurations[key] = value as AnySchemaConfiguration;
    }
  }

  return configurations;
}
