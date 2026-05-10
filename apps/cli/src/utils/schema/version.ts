import { createHash } from "node:crypto";

import type { NormalizedSchema } from "../../domain/schema/normalized-schema";

/**
 * Compute a deterministic sha256 hash of a normalized schema. The result is
 * what `voidhash types generate` bakes into the `.d.ts` header and what
 * `voidhash types check` compares against the server.
 *
 * The hash is order-independent (slugs sorted) so unrelated reorderings
 * don't churn the version.
 */
export function computeSchemaVersionFromNormalized(
  schema: NormalizedSchema
): string {
  const sortedProducts = [...schema.products.values()]
    .map((product) => ({
      name: product.name,
      perks: [...product.perks].sort(),
      providers: [...product.providers]
        .map((provider) => ({
          providerId: provider.providerId,
          configuration: provider.configuration,
        }))
        .sort((a, b) => a.providerId.localeCompare(b.providerId)),
      slug: product.slug,
      type: product.type,
    }))
    .sort((a, b) => a.slug.localeCompare(b.slug));

  const sortedLocations = [...schema.locations.values()]
    .map((location) => ({
      description: location.description,
      name: location.name,
      slug: location.slug,
    }))
    .sort((a, b) => a.slug.localeCompare(b.slug));

  const sortedPerks = [...schema.perks.values()]
    .map((perk) => ({ name: perk.name, slug: perk.slug }))
    .sort((a, b) => a.slug.localeCompare(b.slug));

  const payload = JSON.stringify({
    locations: sortedLocations,
    perks: sortedPerks,
    products: sortedProducts,
  });

  return `sha256:${createHash("sha256").update(payload).digest("hex")}`;
}

export const VOIDHASH_VERSION_COMMENT_PREFIX = "// @voidhash:version ";
export const VOIDHASH_FETCHED_AT_COMMENT_PREFIX = "// @voidhash:fetched-at ";

/**
 * Extract the version header from a generated `.d.ts`, if present.
 * Returns null when the header is missing (e.g. the file was hand-edited).
 */
export function parseVersionFromDeclaration(content: string): string | null {
  for (const line of content.split(/\r?\n/)) {
    if (line.startsWith(VOIDHASH_VERSION_COMMENT_PREFIX)) {
      return line.slice(VOIDHASH_VERSION_COMMENT_PREFIX.length).trim();
    }
  }
  return null;
}
