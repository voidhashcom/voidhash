import { Effect } from "effect";

import { describe, expect, it } from "../../../src/testing/effect-vitest.ts";

import {
  type SchemaProjection,
  computeSchemaVersion,
  mapDbProviderIdToSchemaProviderId,
} from "../../../src/services/schema/helpers.ts";

/**
 * Fresh, fully-populated projection builder. Returns a new object every call so
 * no test can mutate shared state; pass `overrides` to perturb one dimension.
 */
const projection = (overrides: Partial<SchemaProjection> = {}): SchemaProjection => ({
  perks: [
    { slug: "z-perk", name: "Z Perk" },
    { slug: "a-perk", name: "A Perk" },
  ],
  locations: [
    { slug: "b-loc", name: "B Loc", description: "desc-b" },
    { slug: "a-loc", name: "A Loc", description: null },
  ],
  products: [
    {
      slug: "pro",
      name: "Pro",
      type: "subscription",
      perks: ["z-perk", "a-perk"],
      providers: [
        { providerId: "googlePlay", configuration: { sku: "g" } },
        { providerId: "appleAppStore", configuration: { sku: "a" } },
      ],
    },
    {
      slug: "basic",
      name: "Basic",
      type: "subscription",
      perks: ["a-perk"],
      providers: [],
    },
  ],
  enabledProviders: ["appleAppStore", "googlePlay"],
  ...overrides,
});

const empty = (): SchemaProjection => ({
  perks: [],
  locations: [],
  products: [],
  enabledProviders: [],
});

// Known-good vectors, computed against the same canonical serialization the CLI
// (`apps/cli/src/utils/schema/version.ts`) uses. These pin the byte-level
// contract: if the field/sort order ever drifts from the CLI, these break.
const EMPTY_HASH = "sha256:3f90ef2a787d32c6dfe6a60ffe6e9aed5dfc614bc6e26d0d433cc64b9a0acbc5";
const POPULATED_HASH = "sha256:5f6001dfe6a80394f6a724810d3b5bcf1c294b1631b9c5fb4796e8e61206e981";

describe("mapDbProviderIdToSchemaProviderId", () => {
  it("maps 'apple-app-store' to 'appleAppStore'", () => {
    expect(mapDbProviderIdToSchemaProviderId("apple-app-store")).toBe("appleAppStore");
  });

  it("maps 'google-play' to 'googlePlay'", () => {
    expect(mapDbProviderIdToSchemaProviderId("google-play")).toBe("googlePlay");
  });

  it("returns null for 'stripe' (not surfaced by the schema contract yet)", () => {
    expect(mapDbProviderIdToSchemaProviderId("stripe")).toBeNull();
  });

  it.each(["", "appleAppStore", "Apple-App-Store", "unknown-provider", "google_play"])(
    "returns null for unknown provider id %o",
    (dbProviderId) => {
      expect(mapDbProviderIdToSchemaProviderId(dbProviderId)).toBeNull();
    },
  );
});

describe("computeSchemaVersion", () => {
  it.effect("returns a sha256:<hex> hash matching the canonical empty-projection vector", () =>
    Effect.gen(function* () {
      const version = yield* computeSchemaVersion(empty());
      expect(version).toBe(EMPTY_HASH);
      expect(version).toMatch(/^sha256:[0-9a-f]{64}$/);
    }),
  );

  it.effect("returns the canonical vector for a populated projection (CLI byte-for-byte)", () =>
    Effect.gen(function* () {
      const version = yield* computeSchemaVersion(projection());
      expect(version).toBe(POPULATED_HASH);
    }),
  );

  it.effect("is deterministic: same projection → same hash", () =>
    Effect.gen(function* () {
      const a = yield* computeSchemaVersion(projection());
      const b = yield* computeSchemaVersion(projection());
      expect(a).toBe(b);
    }),
  );

  it.effect("changes when products change", () =>
    Effect.gen(function* () {
      const base = yield* computeSchemaVersion(projection());
      const changed = yield* computeSchemaVersion(
        projection({
          products: [
            {
              slug: "pro",
              name: "Pro Renamed",
              type: "subscription",
              perks: ["a-perk"],
              providers: [],
            },
          ],
        }),
      );
      expect(changed).not.toBe(base);
    }),
  );

  it.effect("changes when perks change", () =>
    Effect.gen(function* () {
      const base = yield* computeSchemaVersion(projection());
      const changed = yield* computeSchemaVersion(
        projection({
          perks: [
            { slug: "a-perk", name: "A Perk" },
            { slug: "z-perk", name: "Z Perk Renamed" },
          ],
        }),
      );
      expect(changed).not.toBe(base);
    }),
  );

  it.effect("changes when locations change", () =>
    Effect.gen(function* () {
      const base = yield* computeSchemaVersion(projection());
      const changed = yield* computeSchemaVersion(
        projection({
          locations: [{ slug: "a-loc", name: "A Loc Renamed", description: null }],
        }),
      );
      expect(changed).not.toBe(base);
    }),
  );

  it.effect("is order-independent: products, perks, locations, perk slugs and providers are sorted before hashing", () =>
    Effect.gen(function* () {
      const ordered = projection({
        perks: [
          { slug: "a-perk", name: "A Perk" },
          { slug: "z-perk", name: "Z Perk" },
        ],
        locations: [
          { slug: "a-loc", name: "A Loc", description: null },
          { slug: "b-loc", name: "B Loc", description: "desc-b" },
        ],
        products: [
          {
            slug: "basic",
            name: "Basic",
            type: "subscription",
            perks: ["a-perk"],
            providers: [],
          },
          {
            slug: "pro",
            name: "Pro",
            type: "subscription",
            perks: ["a-perk", "z-perk"],
            providers: [
              { providerId: "appleAppStore", configuration: { sku: "a" } },
              { providerId: "googlePlay", configuration: { sku: "g" } },
            ],
          },
        ],
      });
      // `projection()` supplies the same content but with products, perks,
      // locations, perk slugs and providers all in the opposite order.
      const shuffled = yield* computeSchemaVersion(projection());
      const sorted = yield* computeSchemaVersion(ordered);
      expect(shuffled).toBe(sorted);
      expect(sorted).toBe(POPULATED_HASH);
    }),
  );

  it.effect("ignores enabledProviders — it is not part of the hashed payload", () =>
    Effect.gen(function* () {
      const withProviders = yield* computeSchemaVersion(projection());
      const withoutProviders = yield* computeSchemaVersion(
        projection({ enabledProviders: [] }),
      );
      expect(withoutProviders).toBe(withProviders);
    }),
  );

  it.effect("handles empty product/perk/location/provider arrays", () =>
    Effect.gen(function* () {
      const version = yield* computeSchemaVersion(empty());
      expect(version).toBe(EMPTY_HASH);
    }),
  );
});
