import { FileSystem } from "@effect/platform";
import { Effect } from "effect";

import type { Writable } from "../../utils/types";
import type { NormalizedSchema, ProviderId } from "../schema/normalized-schema";
import type { VoidhashConfigSchema } from "../schema/voidhash-config";

/**
 * Convert slug to camelCase variable name
 * e.g., "all-access" -> "allAccess", "monthly_sub" -> "monthlySub"
 */
function slugToCamelCase(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((part, i) =>
      i === 0
        ? part.toLowerCase()
        : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
    )
    .join("");
}

function toTsStringLiteral(value: string): string {
  return JSON.stringify(value);
}

/**
 * Generate TypeScript code for a schema file
 */
function generateSchemaCode(schema: NormalizedSchema): string {
  const lines: string[] = [];

  // Collect all provider IDs used
  const providerIds = new Set<ProviderId>();
  for (const product of schema.products.values()) {
    for (const provider of product.providers) {
      providerIds.add(provider.providerId);
    }
  }
  // Also include providers from enabledProviders
  for (const providerId of schema.enabledProviders) {
    providerIds.add(providerId);
  }

  // Imports
  lines.push(
    'import { schemaConfiguration, unlockablePerk } from "@voidhash/react-native";'
  );
  lines.push("");

  // Schema configuration
  lines.push("export const sc = schemaConfiguration({");

  // Perks
  lines.push("  perks: {");
  const sortedPerks = [...schema.perks.values()].sort((a, b) =>
    a.slug.localeCompare(b.slug)
  );
  for (const perk of sortedPerks) {
    const varName = slugToCamelCase(perk.slug);
    lines.push(
      `    ${varName}: unlockablePerk(${toTsStringLiteral(perk.slug)}, { name: ${toTsStringLiteral(perk.name)} }),`
    );
  }
  lines.push("  },");

  // Providers
  lines.push("  providers: {");
  const sortedProviders = [...providerIds].sort();
  for (const providerId of sortedProviders) {
    lines.push(`    ${providerId}: true,`);
  }
  lines.push("  },");

  lines.push("});");
  lines.push("");

  // Paywall locations
  const sortedLocations = [...schema.locations.values()].sort((a, b) =>
    a.slug.localeCompare(b.slug)
  );
  for (const location of sortedLocations) {
    const varName = slugToCamelCase(location.slug);
    lines.push(
      `export const ${varName} = sc.location(${toTsStringLiteral(location.slug)}, {`
    );
    lines.push(`  name: ${toTsStringLiteral(location.name)},`);
    if (location.description !== null) {
      lines.push(`  description: ${toTsStringLiteral(location.description)},`);
    }
    lines.push("});");
    lines.push("");
  }

  // Products
  const sortedProducts = [...schema.products.values()].sort((a, b) =>
    a.slug.localeCompare(b.slug)
  );
  for (const product of sortedProducts) {
    const varName = slugToCamelCase(product.slug);
    lines.push(
      `export const ${varName} = sc.subscription(${toTsStringLiteral(product.slug)}, {`
    );
    lines.push(`  name: ${toTsStringLiteral(product.name)},`);

    // Perks
    lines.push("  perks: {");
    const sortedProductPerks = [...product.perks].sort();
    for (const perkSlug of sortedProductPerks) {
      const perkVarName = slugToCamelCase(perkSlug);
      lines.push(`    ${perkVarName}: true,`);
    }
    lines.push("  },");

    // Providers
    lines.push("  providers: {");
    const sortedProductProviders = [...product.providers].sort((a, b) =>
      a.providerId.localeCompare(b.providerId)
    );
    for (const provider of sortedProductProviders) {
      const configStr = JSON.stringify(provider.configuration, null, 2)
        .split("\n")
        .map((line, i) => (i === 0 ? line : `    ${line}`))
        .join("\n");
      lines.push(`    ${provider.providerId}: ${configStr},`);
    }
    lines.push("  },");

    lines.push("});");
    lines.push("");
  }

  return lines.join("\n");
}

export class Codegen extends Effect.Service<Codegen>()("voidhash-cli/Codegen", {
  dependencies: [],
  // Define how to create the service
  effect: Effect.gen(function* effect() {
    const fileSystem = yield* FileSystem.FileSystem;

    const generateVoidhashConfigFile = (
      filePath: string,
      config: Writable<typeof VoidhashConfigSchema.Type>
    ) =>
      Effect.gen(function* generateVoidhashConfigFile() {
        const content = `import { defineConfig } from 'voidhash-cli';

export default defineConfig({
  team: '${config.team}',
  project: '${config.project}',
  schema: '${config.schema}'
});
`;
        yield* fileSystem.writeFileString(filePath, content);
      });

    const generateClientFile = (filePath: string) =>
      Effect.gen(function* generateClientFile() {});

    const generateSchemaFile = (filePath: string, schema: NormalizedSchema) =>
      Effect.gen(function* generateSchemaFile() {
        const content = generateSchemaCode(schema);
        yield* fileSystem.writeFileString(filePath, content);
      });

    return {
      generateClientFile,
      generateSchemaFile,
      generateVoidhashConfigFile,
    } as const;
  }),
}) {}
