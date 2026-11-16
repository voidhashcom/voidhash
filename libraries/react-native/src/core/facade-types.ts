import type { SdkResolvedPaywallJsonEncoding as SdkResolvedPaywall } from "./networking/generated/sdk-client";

/** One evaluated flag. Plain JSON values, as the Voidhash API answers them. */
export interface SdkFeatureFlag {
  readonly enabled: boolean;
  readonly key: string;
  /** The selected variant's payload; untyped JSON, `null` when there is none. */
  readonly payload: unknown;
  /** The selected variant's key, `null` for a flag without variants. */
  // oxlint-disable-next-line effect/prefer-option-over-null -- public answer consumed by non-Effect app code.
  readonly variantKey: string | null;
}

export interface FeatureFlagsResult {
  /** Each flag's enabled state, variant key (`null` without a variant) and payload. */
  readonly flags: ReadonlyArray<SdkFeatureFlag>;
  /**
   * The evaluation was served from cache past its refresh window, or no
   * evaluation has ever succeeded. Flags are still safe to act on — they are
   * simply not guaranteed to reflect the latest dashboard state.
   */
  readonly isStale?: boolean;
}

/**
 * Developer-facing person attributes. `email` and `name` are reserved keys
 * mapped to the dedicated server fields; any other key is a custom trait,
 * whose value must be a string, a number, a boolean or `null`.
 */
export interface PersonAttributes {
  email?: string;
  name?: string;
  [k: string]: unknown;
}

/** A group property's value: text, a number or a boolean. */
export type GroupPropertyValue = string | number | boolean;

/** A group's properties, such as a company's `name`, `plan` or `seats`. */
export type GroupProperties = Readonly<Record<string, GroupPropertyValue>>;

/** A group for `setGroups()`: its id, and any properties of the group beside it. */
export type Group = { readonly id: string | number } & GroupProperties;

/**
 * The groups `setGroups()` puts the end user in, by group type: each an id or
 * a {@link Group}. A type that is `null` or `undefined` is not in the set.
 */
// oxlint-disable-next-line effect/prefer-option-over-null -- public SDK input from non-Effect app code, where `organization && {...}` naturally yields null or undefined.
export type Groups = Readonly<Record<string, Group | string | number | null | undefined>>;

/**
 * What the server assigns to a placement, passed through untouched: the
 * showing and its release with the flow package, or `null` when nothing is
 * assigned.
 */
// oxlint-disable-next-line effect/prefer-option-over-null -- mirrors the server's "no paywall assigned" answer, which the SDK passes through as `null`.
export type ResolvedPaywall = SdkResolvedPaywall | null;
