/**
 * Schema registry — the mechanism by which a generated `voidhash.gen.d.ts`
 * teaches the SDK about the project-specific schema (product slugs, paywall
 * location slugs, perk slugs) defined on the server.
 *
 * Usage in user code: the user runs `voidhash-cli types generate`, which writes a
 * declaration file augmenting this interface. Once that file is part of the
 * project's TypeScript compilation, hooks like `usePaywallByLocation(slug)`
 * autocomplete the literal union of valid slugs.
 *
 * When no augmentation is present (e.g. before the first generate, or in
 * isolated tests), the resolved types degrade gracefully to `string`.
 */

// intentional - user code augments this
export interface VoidhashRegister {}

/**
 * Shape required of the augmented schema. Generated `voidhash.gen.d.ts`
 * declares `interface VoidhashRegister { schema: { products: ...; locations: ...; perks: ... } }`.
 */
export interface VoidhashRegisterShape {
  schema: {
    products: string;
    locations: string;
    perks: string;
  };
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
