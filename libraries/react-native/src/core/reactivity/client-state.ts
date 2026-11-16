import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Str from "effect/String";
import { Atom, type AtomRegistry } from "effect/reactivity";

import type { VoidhashError } from "../../errors";
import type { Person } from "../entities/person";
import type { Product } from "../entities/product";
import type { FeatureFlagsResult } from "../facade-types";
import type { RuntimeSchema } from "../schema/runtime";

export type { FeatureFlagsResult };

// The SDK's state atoms are `keepAlive`: they hold state rather than derive
// it, so a value published while no component is subscribed (a background
// refresh, a schema that lands after boot) must still be there for the next
// read. Each client has its own registry, so nothing outlives the client.

/**
 * Reactive store of the currently identified person. Published together with
 * its freshness through {@link publishCurrentPerson}; read by `useHasPerk`
 * and `useCurrentPerson`.
 */
export const currentPersonAtom: Atom.Writable<Option.Option<Person>> = Atom.keepAlive(
  Atom.make<Option.Option<Person>>(Option.none()),
);

/** How far a published person can be trusted, as the read that produced it reported. */
export interface PersonFreshness {
  /** Served from cache past its refresh window. */
  readonly isStale: boolean;
  /** Served from cache past its TTL. */
  readonly isExpired: boolean;
}

/** Freshness of a snapshot the server has just answered with. */
export const FRESH_PERSON: PersonFreshness = { isExpired: false, isStale: false };

/**
 * Freshness of a person the server has not confirmed for this identity yet:
 * nothing is known about it, or all there is was carried over from another
 * identity. Matches what a read reports with nothing cached.
 */
export const UNCONFIRMED_PERSON: PersonFreshness = { isExpired: false, isStale: true };

/** Freshness of the value in {@link currentPersonAtom}. */
export const currentPersonFreshnessAtom: Atom.Writable<PersonFreshness> = Atom.keepAlive(
  Atom.make<PersonFreshness>(FRESH_PERSON),
);

/**
 * Publishes the current person together with how far it can be trusted, in
 * one batch, so a hook never pairs a snapshot with another one's freshness.
 */
export const publishCurrentPerson = (
  registry: AtomRegistry.AtomRegistry,
  person: Option.Option<Person>,
  freshness: PersonFreshness,
) =>
  Atom.batch(() => {
    registry.set(currentPersonFreshnessAtom, freshness);
    registry.set(currentPersonAtom, person);
  });

/**
 * Reactive mirror of the runtime schema `SchemaManager` resolved at init and
 * refreshes in the background, for hooks that re-render when a newer schema
 * lands. `None` until init has resolved a schema. Operations read the schema
 * from `SchemaManager` itself, not from here.
 */
export const schemaAtom: Atom.Writable<Option.Option<RuntimeSchema>> = Atom.keepAlive(
  Atom.make<Option.Option<RuntimeSchema>>(Option.none()),
);

/** The products every `useProducts()` reads: one load for the whole client. */
export interface ProductsState {
  /** Every product the store returned, sorted by slug; `None` until a load answered. */
  readonly products: Option.Option<ReadonlyArray<Product>>;
  /** The error that stopped the last load; the products of the load before it are kept. */
  readonly error: Option.Option<VoidhashError>;
  /** A load is running. */
  readonly isLoading: boolean;
}

/** Products before any load. */
export const NO_PRODUCTS: ProductsState = {
  error: Option.none(),
  isLoading: false,
  products: Option.none(),
};

/**
 * The client's products, shared by every `useProducts()`. Loaded again when
 * the identity switches, the schema's product definitions change, or a
 * purchase completes, since offers and their eligibility are the end user's.
 */
export const productsAtom: Atom.Writable<ProductsState> = Atom.keepAlive(
  Atom.make<ProductsState>(NO_PRODUCTS),
);

/**
 * Reactive store of feature flag results, keyed by their normalized flag-key
 * request signature (see {@link normalizeFeatureFlagKeys}). Keeping every
 * request set in its own slot prevents one hook's fetch from overwriting the
 * value of another hook that asked for a different set of flags.
 */
export const featureFlagsByKeyAtom: Atom.Writable<Readonly<Record<string, FeatureFlagsResult>>> =
  Atom.keepAlive(Atom.make<Readonly<Record<string, FeatureFlagsResult>>>({}));

/**
 * Counts identity switches: `identify()`, `reset()`, a switch the server
 * refused and the SDK undid. `identify()` and `reset()` clear the person and
 * the flags; hooks read this so a mounted hook refetches for the identity now
 * in place instead of showing the cleared state until it remounts.
 */
export const identityEpochAtom: Atom.Writable<number> = Atom.keepAlive(Atom.make(0));

/**
 * Counts the runs of the client: every `init()` that started the native
 * client, the first one included. `end()` drops what a run loaded, such as
 * the products; a hook that loads on mount reads this, so it loads again when
 * the app calls `end()` and then `init()` while it stays mounted.
 */
export const clientRunAtom: Atom.Writable<number> = Atom.keepAlive(Atom.make(0));

const FeatureFlagKeysFromJson = Schema.fromJsonString(Schema.Array(Schema.String));
const encodeFeatureFlagKeys = Schema.encodeSync(FeatureFlagKeysFromJson);

const decodeFeatureFlagKeysFromJson = Schema.decodeSync(FeatureFlagKeysFromJson);

/**
 * The sorted keys a signature other than `"all"` was built from; the inverse
 * of {@link normalizeFeatureFlagKeys}.
 */
export const decodeFeatureFlagKeys = (signature: string): ReadonlyArray<string> =>
  decodeFeatureFlagKeysFromJson(signature);

/**
 * Normalizes a feature-flag request signature so that any callers asking for
 * the same set of keys (regardless of order) share the same atom slot. We
 * sort a copy because the caller's array is part of their input and must not
 * be mutated.
 */
export const normalizeFeatureFlagKeys = (flagKeys?: readonly string[]): string => {
  return Option.match(Option.fromUndefinedOr(flagKeys), {
    onNone: () => "all",
    onSome: (keys) =>
      Arr.match(keys, {
        onEmpty: () => "all",
        onNonEmpty: (values) => encodeFeatureFlagKeys(Arr.sort(values, Str.Order)),
      }),
  });
};

const featureFlagsForNormalizedKeyAtom = Atom.family((normalizedKey: string) =>
  Atom.make((get): Option.Option<FeatureFlagsResult> => {
    const byKey = get(featureFlagsByKeyAtom);
    return Option.fromUndefinedOr(byKey[normalizedKey]);
  }),
);

/**
 * Derived atom that returns the cached `FeatureFlagsResult` for a particular
 * set of flag keys (or `null` if nothing has been published yet). Reusing
 * the same normalized key across requests means callers subscribe to the
 * minimum slice of state they care about.
 */
export const featureFlagsForKeysAtom = (flagKeys?: readonly string[]) =>
  featureFlagsForNormalizedKeyAtom(normalizeFeatureFlagKeys(flagKeys));
