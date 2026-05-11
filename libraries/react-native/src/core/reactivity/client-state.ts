import type { SdkPerson as SdkCustomer } from "@voidhash/generated-clients";
import { Atom } from "effect/unstable/reactivity";

import type { FeatureFlagsResult } from "../feature-flags/feature-flag-service";

export type { FeatureFlagsResult };

/**
 * Reactive store of the currently identified customer. Written by the
 * customer/identity facade paths and read by `useCurrentCustomer`.
 */
export const currentCustomerAtom: Atom.Writable<SdkCustomer | null> =
  Atom.make<SdkCustomer | null>(null);

/**
 * Reactive store of feature flag results, keyed by their normalized flag-key
 * request signature (see {@link normalizeFeatureFlagKeys}). Keeping every
 * request set in its own slot prevents one hook's fetch from overwriting the
 * value of another hook that asked for a different set of flags.
 */
export const featureFlagsByKeyAtom: Atom.Writable<
  Readonly<Record<string, FeatureFlagsResult>>
> = Atom.make<Readonly<Record<string, FeatureFlagsResult>>>({});

/**
 * Normalizes a feature-flag request signature so that any callers asking for
 * the same set of keys (regardless of order) share the same atom slot. We
 * sort a copy because the caller's array is part of their input and must not
 * be mutated.
 */
export const normalizeFeatureFlagKeys = (
  flagKeys?: readonly string[]
): string => {
  if (!flagKeys || flagKeys.length === 0) {
    return "all";
  }
  return [...flagKeys].sort().join(",");
};

const featureFlagsForNormalizedKeyAtom = Atom.family((normalizedKey: string) =>
  Atom.make((get): FeatureFlagsResult | null => {
    const byKey = get(featureFlagsByKeyAtom);
    return byKey[normalizedKey] ?? null;
  })
);

/**
 * Derived atom that returns the cached `FeatureFlagsResult` for a particular
 * set of flag keys (or `null` if nothing has been published yet). Reusing
 * the same normalized key across requests means callers subscribe to the
 * minimum slice of state they care about.
 */
export const featureFlagsForKeysAtom = (flagKeys?: readonly string[]) =>
  featureFlagsForNormalizedKeyAtom(normalizeFeatureFlagKeys(flagKeys));
