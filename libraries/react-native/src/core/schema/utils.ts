import { ProductDefinition } from "./products/base";
import type {
  AnySchemaConfiguration,
  ExtractSchemaConfigurations,
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
      typeof value.subscription === "function"
    ) {
      // @ts-expect-error - TypeScript can't infer that key is a valid configuration key, but we know it is
      configurations[key] = value as AnySchemaConfiguration;
    }
  }

  return configurations;
}
