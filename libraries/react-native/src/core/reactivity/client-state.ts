import type { SdkPerson } from "@voidhash/generated-clients";
import { Atom } from "effect/unstable/reactivity";

import type { FeatureFlagsResult } from "../feature-flags/feature-flag-service";
import type { RuntimeSchema } from "../schema/runtime";

export type { FeatureFlagsResult };

/**
 * Reactive store of the currently identified person. Written by the
 * person/identity facade paths and read by `useCurrentPerson`.
 */
export const currentPersonAtom: Atom.Writable<SdkPerson | null> = Atom.make<SdkPerson | null>(null);

/**
 * Reactive store of the runtime schema fetched at init time and refreshed
 * in the background by `SchemaManager`. `null` until init has resolved a
 * schema. Read by React hooks that need to react to in-session refreshes
 * (e.g. when the SWR background fetch lands a newer schema than the one
 * served at init). Note: on a cache-hit init, subscribers may observe two
 * publishes — the cached value first, then the freshly refreshed value
 * when the background fetch lands. The two values are usually identical.
 */
export const schemaAtom: Atom.Writable<RuntimeSchema | null> = Atom.make<RuntimeSchema | null>(
  null,
);

/**
 * Reactive store of feature flag results, keyed by their normalized flag-key
 * request signature (see {@link normalizeFeatureFlagKeys}). Keeping every
 * request set in its own slot prevents one hook's fetch from overwriting the
 * value of another hook that asked for a different set of flags.
 */
export const featureFlagsByKeyAtom: Atom.Writable<Readonly<Record<string, FeatureFlagsResult>>> =
  Atom.make<Readonly<Record<string, FeatureFlagsResult>>>({});

/**
 * Normalizes a feature-flag request signature so that any callers asking for
 * the same set of keys (regardless of order) share the same atom slot. We
 * sort a copy because the caller's array is part of their input and must not
 * be mutated.
 */
export const normalizeFeatureFlagKeys = (flagKeys?: readonly string[]): string => {
  if (!flagKeys || flagKeys.length === 0) {
    return "all";
  }
  return [...flagKeys].sort().join(",");
};

const featureFlagsForNormalizedKeyAtom = Atom.family((normalizedKey: string) =>
  Atom.make((get): FeatureFlagsResult | null => {
    const byKey = get(featureFlagsByKeyAtom);
    return byKey[normalizedKey] ?? null;
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
