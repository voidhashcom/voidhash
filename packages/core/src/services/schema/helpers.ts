import { Effect } from "effect";
import { subtle } from "uncrypto";

import type { SchemaProviderId } from "../../domain/schema/Schema.ts";

/**
 * Internal projection shape used to compute the deterministic schema version
 * hash. Mirrors {@link ProjectSchema} minus the `version` field — feeding the
 * derived value back into the hash would be circular.
 */
export interface SchemaProjection {
  readonly perks: ReadonlyArray<{ readonly slug: string; readonly name: string }>;
  readonly locations: ReadonlyArray<{
    readonly slug: string;
    readonly name: string;
    readonly description: string | null;
  }>;
  readonly products: ReadonlyArray<{
    readonly slug: string;
    readonly name: string;
    readonly type: "subscription" | "one-time" | "one-time-consumable";
    readonly perks: ReadonlyArray<string>;
    readonly providers: ReadonlyArray<{
      readonly providerId: SchemaProviderId;
      readonly configuration: Record<string, unknown>;
    }>;
  }>;
  readonly enabledProviders: ReadonlyArray<SchemaProviderId>;
}

const DB_PROVIDER_ID_TO_SCHEMA: Record<string, SchemaProviderId> = {
  "apple-app-store": "appleAppStore",
  "google-play": "googlePlay",
};

/**
 * Map a database `providerId` to the schema `providerId` used by the CLI and
 * SDK. Returns `null` for providers the schema contract doesn't surface yet
 * (e.g. `"stripe"`); callers should drop those rows.
 */
export const mapDbProviderIdToSchemaProviderId = (dbProviderId: string): SchemaProviderId | null =>
  DB_PROVIDER_ID_TO_SCHEMA[dbProviderId] ?? null;

/**
 * Compute the deterministic `sha256:<hex>` schema version hash from a
 * canonical {@link SchemaProjection}.
 *
 * The byte-level layout matches the CLI's `computeSchemaVersionFromNormalized`
 * exactly (field order, sort order, empty-array shape). Don't reorder anything
 * here without making the matching change in
 * `apps/cli/src/utils/schema/version.ts` — the CLI's `voidhash types check`
 * compares the two hashes byte-for-byte.
 *
 * Uses WebCrypto via `uncrypto` so this runs natively on Cloudflare Workers
 * (the legacy implementation used `node:crypto`).
 */
export const computeSchemaVersion = (projection: SchemaProjection): Effect.Effect<string> =>
  Effect.promise(async () => {
    // Field order matches the CLI emit. Per Node docs, `JSON.stringify`
    // preserves insertion order for non-integer string keys.
    const products = [...projection.products]
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

    const locations = [...projection.locations]
      .map((location) => ({
        description: location.description,
        name: location.name,
        slug: location.slug,
      }))
      .sort((a, b) => a.slug.localeCompare(b.slug));

    const perks = [...projection.perks]
      .map((perk) => ({ name: perk.name, slug: perk.slug }))
      .sort((a, b) => a.slug.localeCompare(b.slug));

    const payload = JSON.stringify({ locations, perks, products });
    const hashBuffer = await subtle.digest("SHA-256", new TextEncoder().encode(payload));
    const hashHex = [...new Uint8Array(hashBuffer)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    return `sha256:${hashHex}`;
  });
