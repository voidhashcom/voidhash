/**
 * Schema registry — the mechanism by which a generated `voidhash.gen.d.ts`
 * teaches the SDK about the project-specific schema (product slugs, paywall
 * location slugs, perk slugs, feature flag keys and their variant values)
 * defined on the server.
 *
 * Usage in user code: the user runs `voidhash-cli types generate`, which writes a
 * declaration file augmenting this interface. Once that file is part of the
 * project's TypeScript compilation, hooks like `usePresentFlow(slug)`
 * autocomplete the literal union of valid slugs.
 *
 * When no augmentation is present (e.g. before the first generate, or in
 * isolated tests), the resolved types degrade gracefully to `string`.
 */

// intentional - user code augments this
export interface VoidhashRegister {}

/**
 * Shape required of the augmented schema. Generated `voidhash.gen.d.ts`
 * declares `interface VoidhashRegister { schema: { products: ...; locations: ...; perks: ...; flags: ... }; productTypes: { ... }; flagValues: { ... } }`.
 * Files generated before `flags` and `flagValues` existed leave them out;
 * flag keys and variant values are then typed as `string`.
 */
export interface VoidhashRegisterShape {
  schema: {
    products: string;
    locations: string;
    perks: string;
    flags: string;
  };
  /**
   * Each product slug's Studio type. Files generated before it existed leave
   * it out; their products are then typed as any `Product`.
   */
  productTypes: Readonly<Record<string, "subscription" | "consumable" | "nonConsumable">>;
  /** The text values of each flag's variants, for the flags whose variants have them. */
  flagValues: Readonly<Record<string, string>>;
}

type Resolve<K extends keyof VoidhashRegisterShape["schema"]> = VoidhashRegister extends {
  schema: { [P in K]: infer V extends string };
}
  ? // When the augmentation declares an empty union (`never`) — e.g. the
    // placeholder `voidhash.gen.d.ts` written before the first real
    // generation — fall back to `string` so user code still compiles.
    [V] extends [never]
    ? string
    : V
  : string;

/** Resolves to the literal union of product slugs declared on the server, or `string` when the .d.ts isn't loaded. */
export type ProductSlug = Resolve<"products">;

/** Resolves to the literal union of paywall location slugs declared on the server, or `string` when the .d.ts isn't loaded. */
export type LocationSlug = Resolve<"locations">;

/** Resolves to the literal union of perk slugs declared on the server, or `string` when the .d.ts isn't loaded. */
export type PerkSlug = Resolve<"perks">;

/**
 * Each product slug's Studio type as the generated `voidhash.gen.d.ts`
 * declares it (`subscription`, `consumable` or `nonConsumable`), or `{}`
 * without it. `useProducts(slugs)` types each product by it.
 */
export type RegisteredProductTypes = VoidhashRegister extends { productTypes: infer Types }
  ? Types
  : Record<never, never>;

/** Resolves to the literal union of the project's feature flag keys (archived ones left out), or `string` when the .d.ts isn't loaded. */
export type FeatureFlagKey = Resolve<"flags">;

/**
 * The text values flag `K`'s variants had when `voidhash.gen.d.ts` was
 * generated, which editors suggest, or any other text: a variant added since
 * is not in the file until it is generated again, so code that matches on the
 * value keeps a branch for other values. Any text when the .d.ts isn't loaded
 * or the flag's variants had none.
 */
export type FeatureFlagValue<K extends string> =
  // oxlint-disable-next-line typescript/no-redundant-type-constituents -- `never` only in the SDK's own build; an app's generated file fills in the listed values.
  | ListedFlagValue<K>
  // Any other text, without hiding the listed values from autocomplete.
  | (string & Record<never, never>);

/** The text values `voidhash.gen.d.ts` lists for flag `K`; none without them. */
type ListedFlagValue<K extends string> = VoidhashRegister extends { flagValues: infer Values }
  ? K extends keyof Values
    ? Values[K]
    : never
  : never;
