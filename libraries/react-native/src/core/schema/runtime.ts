/**
 * Plain-data shapes representing the schema as fetched from the server at
 * runtime. After the server-first redesign, these replace the old DSL-built
 * `ProductDefinition` / `PaywallLocationDefinition` / `PerkDefinition` classes.
 *
 * The SDK fetches a `RuntimeSchema` on `Provider` mount and uses it for things
 * like resolving product slugs to native store productIds when calling
 * StoreKit / Google Play.
 */

export interface RuntimeAppleAppStoreProductConfiguration {
  readonly productId: string;
}

export interface RuntimeGooglePlayProductConfiguration {
  readonly productId: string;
  readonly basePlanId?: string;
}

export interface RuntimeProductProviders {
  readonly appleAppStore?: RuntimeAppleAppStoreProductConfiguration;
  readonly googlePlay?: RuntimeGooglePlayProductConfiguration;
}

export interface RuntimeProductDefinition {
  readonly slug: string;
  readonly type: "subscription";
  readonly properties: { readonly name: string };
  readonly configuration: {
    readonly providers: RuntimeProductProviders;
    readonly perks: Readonly<Record<string, true>>;
  };
}

export interface RuntimePaywallLocationDefinition {
  readonly slug: string;
  readonly name: string;
  readonly description: string | null;
}

export interface RuntimePerkDefinition {
  readonly slug: string;
  readonly name: string;
}

/**
 * The full schema as fetched from the server. Keyed by slug.
 *
 * The `version` is a sha256 hash of the schema state on the server and is
 * what `voidhash types check` and the dev-mode runtime warning compare
 * against the generated `.d.ts` header.
 */
export interface RuntimeSchema {
  readonly version: string;
  readonly products: Readonly<Record<string, RuntimeProductDefinition>>;
  readonly locations: Readonly<Record<string, RuntimePaywallLocationDefinition>>;
  readonly perks: Readonly<Record<string, RuntimePerkDefinition>>;
}

export const createEmptyRuntimeSchema = (): RuntimeSchema => ({
  version: "",
  products: {},
  locations: {},
  perks: {},
});
