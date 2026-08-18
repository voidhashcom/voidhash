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

export interface RuntimeDevelopmentProductConfiguration {
  readonly currencyCode: "USD";
  readonly duration: "weekly" | "monthly" | "quarterly" | "semi-annual" | "annual" | null;
  readonly period: "week" | "month" | "year" | "lifetime";
  readonly periodCount: number;
  readonly price: number;
  readonly priceInMinorUnits: number;
  readonly productId: string;
  readonly warning: string | null;
}

export interface RuntimeProductProviders {
  readonly appleAppStore?: RuntimeAppleAppStoreProductConfiguration;
  readonly development?: RuntimeDevelopmentProductConfiguration;
  readonly googlePlay?: RuntimeGooglePlayProductConfiguration;
}

export interface RuntimeProductDefinition {
  readonly id?: string;
  readonly duration?: "weekly" | "monthly" | "quarterly" | "semi-annual" | "annual" | null;
  readonly slug: string;
  readonly type: "subscription" | "one-time" | "one-time-consumable";
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
 * what `voidhash-cli types check` and the dev-mode runtime warning compare
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
