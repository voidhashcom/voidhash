import { describe, expect, it } from "vite-plus/test";
import { Effect } from "effect";

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
  it("returns a sha256:<hex> hash matching the canonical empty-projection vector", async () => {
    const version = await Effect.runPromise(computeSchemaVersion(empty()));
    expect(version).toBe(EMPTY_HASH);
    expect(version).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("returns the canonical vector for a populated projection (CLI byte-for-byte)", async () => {
    const version = await Effect.runPromise(computeSchemaVersion(projection()));
    expect(version).toBe(POPULATED_HASH);
  });

  it("is deterministic: same projection → same hash", async () => {
    const a = await Effect.runPromise(computeSchemaVersion(projection()));
    const b = await Effect.runPromise(computeSchemaVersion(projection()));
    expect(a).toBe(b);
  });

  it("changes when products change", async () => {
    const base = await Effect.runPromise(computeSchemaVersion(projection()));
    const changed = await Effect.runPromise(
      computeSchemaVersion(
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
      ),
    );
    expect(changed).not.toBe(base);
  });

  it("changes when perks change", async () => {
    const base = await Effect.runPromise(computeSchemaVersion(projection()));
    const changed = await Effect.runPromise(
      computeSchemaVersion(
        projection({
          perks: [
            { slug: "a-perk", name: "A Perk" },
            { slug: "z-perk", name: "Z Perk Renamed" },
          ],
        }),
      ),
    );
    expect(changed).not.toBe(base);
  });

  it("changes when locations change", async () => {
    const base = await Effect.runPromise(computeSchemaVersion(projection()));
    const changed = await Effect.runPromise(
      computeSchemaVersion(
        projection({
          locations: [{ slug: "a-loc", name: "A Loc Renamed", description: null }],
        }),
      ),
    );
    expect(changed).not.toBe(base);
  });

  it("is order-independent: products, perks, locations, perk slugs and providers are sorted before hashing", async () => {
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
    const shuffled = await Effect.runPromise(computeSchemaVersion(projection()));
    const sorted = await Effect.runPromise(computeSchemaVersion(ordered));
    expect(shuffled).toBe(sorted);
    expect(sorted).toBe(POPULATED_HASH);
  });

  it("ignores enabledProviders — it is not part of the hashed payload", async () => {
    const withProviders = await Effect.runPromise(computeSchemaVersion(projection()));
    const withoutProviders = await Effect.runPromise(
      computeSchemaVersion(projection({ enabledProviders: [] })),
    );
    expect(withoutProviders).toBe(withProviders);
  });

  it("handles empty product/perk/location/provider arrays", async () => {
    const version = await Effect.runPromise(computeSchemaVersion(empty()));
    expect(version).toBe(EMPTY_HASH);
  });
});
