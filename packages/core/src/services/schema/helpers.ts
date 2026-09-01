import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Order from "effect/Order";
import * as Schema from "effect/Schema";
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
    readonly description: Option.Option<string>;
  }>;
  readonly products: ReadonlyArray<{
    readonly duration?: Option.Option<
      "weekly" | "monthly" | "quarterly" | "semi-annual" | "annual"
    >;
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
 * SDK. Returns `None` for providers the schema contract doesn't surface yet
 * (e.g. `"stripe"`); callers should drop those rows.
 */
export const mapDbProviderIdToSchemaProviderId = (
  dbProviderId: string,
): Option.Option<SchemaProviderId> => Option.fromNullishOr(DB_PROVIDER_ID_TO_SCHEMA[dbProviderId]);

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
  Effect.gen(function* () {
    // Field order matches the CLI emit. The JSON codec below serialises in
    // insertion order for non-integer string keys, byte-for-byte as the CLI does.
    const providerOrder = Order.mapInput(
      Order.String,
      (provider: { readonly providerId: SchemaProviderId }) => provider.providerId,
    );
    const slugOrder = Order.mapInput(Order.String, (item: { readonly slug: string }) => item.slug);
    const products = Arr.sort(
      projection.products.map((product) => ({
        duration: Option.getOrNull(product.duration ?? Option.none()),
        name: product.name,
        perks: Arr.sort(product.perks, Order.String),
        providers: Arr.sort(
          product.providers.map((provider) => ({
            providerId: provider.providerId,
            configuration: provider.configuration,
          })),
          providerOrder,
        ),
        slug: product.slug,
        type: product.type,
      })),
      slugOrder,
    );

    const locations = Arr.sort(
      projection.locations.map((location) => ({
        description: Option.getOrNull(location.description),
        name: location.name,
        slug: location.slug,
      })),
      slugOrder,
    );

    const perks = Arr.sort(
      projection.perks.map((perk) => ({ name: perk.name, slug: perk.slug })),
      slugOrder,
    );

    const payload = Schema.encodeSync(Schema.UnknownFromJsonString)({
      locations,
      perks,
      products,
    });
    const hashBuffer = yield* promiseOrDie(() =>
      subtle.digest("SHA-256", new TextEncoder().encode(payload)),
    );
    const hashHex = [...new Uint8Array(hashBuffer)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    return `sha256:${hashHex}`;
  });
import { promiseOrDie } from "../../effect-boundary.ts";
