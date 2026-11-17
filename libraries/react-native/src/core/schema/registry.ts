/**
 * Schema registry — the mechanism by which a generated `voidhash.gen.d.ts`
 * teaches the SDK about the project-specific schema (product slugs, paywall
 * location slugs, perk slugs, feature flag keys and their variant values)
 * defined on the server, and about the interface of the flow shown at each
 * location (its inputs, outputs, outcomes and app actions).
 *
 * Usage in user code: the user runs `voidhash-cli types generate`, which writes a
 * declaration file augmenting this interface. Once that file is part of the
 * project's TypeScript compilation, hooks like `usePresentFlow(slug)`
 * autocomplete the literal union of valid slugs, and `presentFlow(slug, …)`
 * checks the inputs and handlers a location's flow takes and types its result.
 *
 * When no augmentation is present (e.g. before the first generate, or in
 * isolated tests), the resolved types degrade gracefully to `string`, and a
 * location without a declared interface takes and returns plain dictionaries.
 */

// intentional - user code augments this
export interface VoidhashRegister {}

/**
 * A value a flow takes as an input, reports as an output, or exchanges with
 * an app action. A list is an array of strings without repeats.
 */
export type FlowValue = string | number | boolean | readonly string[];

/** Flow values by name. */
export type FlowValues = Readonly<Record<string, FlowValue>>;

/**
 * Runs an app action a flow calls: receives the action's arguments and
 * returns its reply, or nothing when the action replies with no fields. A
 * handler that throws or rejects makes the flow run the action's failure path.
 */
// oxlint-disable-next-line typescript/no-invalid-void-type -- a handler with nothing to reply returns nothing.
export type FlowActionHandler = (
  args: FlowValues,
) => Promise<FlowValues | void> | FlowValues | void;

/**
 * The interface of the flow shown at one location, as generated code declares
 * it. `outcome` lists the outcomes the flow finishes with; the built-in
 * `purchased`, `restored` and `dismissed` are added by the SDK.
 */
export interface VoidhashFlowShape {
  input: object;
  output: object;
  outcome: string;
  actions: object;
}

/**
 * Shape required of the augmented schema. Generated `voidhash.gen.d.ts`
 * declares `interface VoidhashRegister { schema: { products: ...; locations: ...; perks: ...; flags: ... }; productTypes: { ... }; flagValues: { ... } }`,
 * and `flows: { [location slug]: { input; output; outcome; actions } }` for
 * the locations that have an interface. Files generated before `flags` and
 * `flagValues` existed leave them out; flag keys and variant values are then
 * typed as `string`.
 */
export interface VoidhashRegisterShape {
  schema: {
    products: string;
    locations: string;
    perks: string;
    flags: string;
  };
  flows?: Record<string, VoidhashFlowShape>;
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

/** The outcomes every flow can end with, whatever its own interface declares. */
export type BuiltInFlowOutcome = "purchased" | "restored" | "dismissed";

type RegisteredFlows = VoidhashRegister extends { flows: infer Flows } ? Flows : object;

type RegisteredFlowPart<
  L extends string,
  Part extends keyof VoidhashFlowShape,
  Fallback,
> = L extends keyof RegisteredFlows
  ? RegisteredFlows[L] extends { [P in Part]: infer Declared }
    ? Declared
    : Fallback
  : Fallback;

/** The inputs the flow at location `L` takes, or a dictionary when its interface isn't declared. */
export type FlowInput<L extends string = string> = RegisteredFlowPart<L, "input", FlowValues>;

/** The outputs the flow at location `L` reports, or a dictionary when its interface isn't declared. */
export type FlowOutput<L extends string = string> = RegisteredFlowPart<L, "output", FlowValues>;

/**
 * How the flow at location `L` can end: the outcomes its interface declares
 * plus the built-in ones, or `string` when its interface isn't declared.
 */
export type FlowOutcome<L extends string = string> =
  | RegisteredFlowPart<L, "outcome", string>
  | BuiltInFlowOutcome;

/** The app action handlers the flow at location `L` calls, or handlers by name when its interface isn't declared. */
export type FlowActions<L extends string = string> = RegisteredFlowPart<
  L,
  "actions",
  Readonly<Record<string, FlowActionHandler>>
>;

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
