import { FileSystem, Path } from "@effect/platform";
import { Effect } from "effect";

import {
  LocalSchemaNotFoundError,
  LocalSchemaParseError,
} from "../../domain/errors/schema";
import {
  type NormalizedSchema,
  type ProviderId,
  createEmptyNormalizedSchema,
} from "../../domain/schema/normalized-schema";
import { safeRegister } from "../js-loading/js-file-loading";

/**
 * Symbol used to identify schema entity types at runtime.
 * Must match the symbol used in @voidhash/react-native schema definitions.
 */
export const SCHEMA_KIND = Symbol.for("voidhash.schema.kind");

export const SchemaKind = {
  Perk: "perk",
  Product: "product",
  SchemaConfiguration: "schema-configuration",
} as const;

/**
 * Check if a value is a SchemaConfiguration object using the schema kind symbol
 */
export function isSchemaConfiguration(
  value: unknown
): value is {
  perks: Record<string, { slug: string; name: string }>;
  providers: Record<string, boolean>;
  subscription: unknown;
} {
  return (
    value !== null &&
    typeof value === "object" &&
    (value as Record<symbol, unknown>)[SCHEMA_KIND] ===
      SchemaKind.SchemaConfiguration
  );
}

/**
 * Check if a value is a PerkDefinition instance using the schema kind symbol
 */
export function isPerkDefinition(
  value: unknown
): value is { slug: string; name: string } {
  return (
    value !== null &&
    typeof value === "object" &&
    (value as Record<symbol, unknown>)[SCHEMA_KIND] === SchemaKind.Perk
  );
}

/**
 * Check if a value is a ProductDefinition instance using the schema kind symbol
 */
export function isProductDefinition(
  value: unknown
): value is {
  type: string;
  slug: string;
  properties: { name: string };
  configuration: {
    perks?: Record<string, boolean | { _: unknown }>;
    providers?: Record<string, unknown>;
  };
} {
  return (
    value !== null &&
    typeof value === "object" &&
    (value as Record<symbol, unknown>)[SCHEMA_KIND] === SchemaKind.Product
  );
}

/**
 * Extract perk slugs from a product's configuration
 */
export function extractPerkSlugs(
  perksConfig: Record<string, boolean | { _: unknown }> | undefined,
  allPerks: Map<string, { slug: string; name: string }>
): string[] {
  if (!perksConfig) return [];

  const perkSlugs: string[] = [];

  for (const [key, value] of Object.entries(perksConfig)) {
    // Skip the metadata key
    if (key === "_") continue;

    // If value is true, this perk is enabled
    if (value === true) {
      // Find the perk by variable name (key) in our perks map
      // We need to match by the variable name, not slug
      for (const [slug, perk] of allPerks) {
        // The key in the config should match the camelCase version of the slug
        const expectedKey = slugToCamelCase(slug);
        if (expectedKey === key) {
          perkSlugs.push(slug);
          break;
        }
      }
    }
  }

  return perkSlugs;
}

/**
 * Extract provider configurations from a product
 */
export function extractProviderConfigs(
  providersConfig: Record<string, unknown> | undefined
): { providerId: ProviderId; configuration: Record<string, unknown> }[] {
  if (!providersConfig) return [];

  const providers: {
    providerId: ProviderId;
    configuration: Record<string, unknown>;
  }[] = [];

  for (const [providerId, config] of Object.entries(providersConfig)) {
    // Skip the metadata key
    if (providerId === "_") continue;

    // Only include appleAppStore and googlePlay
    if (providerId === "appleAppStore" || providerId === "googlePlay") {
      if (config && typeof config === "object") {
        providers.push({
          configuration: config as Record<string, unknown>,
          providerId,
        });
      }
    }
  }

  return providers;
}

/**
 * Convert slug to camelCase variable name
 * e.g., "all-access" -> "allAccess", "monthly_sub" -> "monthlySub"
 */
export function slugToCamelCase(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((part, i) =>
      i === 0 ? part.toLowerCase() : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
    )
    .join("");
}

/**
 * Load and parse a local schema file into a NormalizedSchema
 */
export const loadLocalSchema = (schemaPath: string) =>
  Effect.gen(function* loadLocalSchema() {
    const fs = yield* FileSystem.FileSystem;
    const pathService = yield* Path.Path;

    // Resolve the absolute path
    const absolutePath = pathService.resolve(schemaPath);

    // Check if file exists
    const exists = yield* fs.exists(absolutePath);
    if (!exists) {
      return yield* Effect.fail(
        new LocalSchemaNotFoundError({ path: schemaPath })
      );
    }

    // Register esbuild for TypeScript
    const { unregister } = yield* safeRegister().pipe(
      Effect.catchTag("FailedToLoadJsFileError", (e) =>
        Effect.fail(
          new LocalSchemaParseError({
            message: `Failed to register TypeScript loader: ${e.message}`,
          })
        )
      )
    );

    // Load the schema module
    let schemaModule: Record<string, unknown>;
    try {
      // Clear require cache to ensure fresh load
      delete require.cache[require.resolve(absolutePath)];
      schemaModule = require(absolutePath);
    } catch (e) {
      unregister();
      return yield* Effect.fail(
        new LocalSchemaParseError({
          message: `Failed to load schema file: ${e instanceof Error ? e.message : String(e)}`,
        })
      );
    }

    unregister();

    // Create the normalized schema
    const schema = createEmptyNormalizedSchema();

    // First pass: extract perks and providers from SchemaConfiguration
    for (const [, value] of Object.entries(schemaModule)) {
      if (isSchemaConfiguration(value)) {
        // Extract perks
        for (const [, perkDef] of Object.entries(value.perks)) {
          if (isPerkDefinition(perkDef)) {
            schema.perks.set(perkDef.slug, {
              name: perkDef.name,
              slug: perkDef.slug,
            });
          }
        }

        // Extract enabled providers
        for (const [providerId, enabled] of Object.entries(value.providers)) {
          if (
            enabled === true &&
            (providerId === "appleAppStore" || providerId === "googlePlay")
          ) {
            schema.enabledProviders.add(providerId);
          }
        }
      }
    }

    // Second pass: extract products
    for (const [, value] of Object.entries(schemaModule)) {
      if (isProductDefinition(value)) {
        const perkSlugs = extractPerkSlugs(
          value.configuration.perks,
          schema.perks
        );
        const providers = extractProviderConfigs(value.configuration.providers);

        // Add providers from this product to enabled providers
        for (const provider of providers) {
          schema.enabledProviders.add(provider.providerId);
        }

        schema.products.set(value.slug, {
          name: value.properties.name,
          perks: perkSlugs,
          providers,
          slug: value.slug,
          type: "subscription", // For now, only subscription is supported
        });
      }
    }

    return schema;
  });
