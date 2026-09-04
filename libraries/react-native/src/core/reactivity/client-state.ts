import type { SdkPerson } from "@voidhash/generated-clients";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Str from "effect/String";
import { Atom } from "effect/unstable/reactivity";

import type { FeatureFlagsResult } from "../feature-flags/feature-flag-service";
import type { RuntimeSchema } from "../schema/runtime";

export type { FeatureFlagsResult };

/**
 * Reactive store of the currently identified person. Written by the
 * person/identity facade paths and read by `useCurrentPerson`.
 */
export const currentPersonAtom: Atom.Writable<Option.Option<SdkPerson>> = Atom.make<
  Option.Option<SdkPerson>
>(Option.none());

/**
 * Reactive store of the runtime schema fetched at init time and refreshed
 * in the background by `SchemaManager`. `null` until init has resolved a
 * schema. Read by React hooks that need to react to in-session refreshes
 * (e.g. when the SWR background fetch lands a newer schema than the one
 * served at init). Note: on a cache-hit init, subscribers may observe two
 * publishes — the cached value first, then the freshly refreshed value
 * when the background fetch lands. The two values are usually identical.
 */
export const schemaAtom: Atom.Writable<Option.Option<RuntimeSchema>> = Atom.make<
  Option.Option<RuntimeSchema>
>(Option.none());

/**
 * Reactive store of feature flag results, keyed by their normalized flag-key
 * request signature (see {@link normalizeFeatureFlagKeys}). Keeping every
 * request set in its own slot prevents one hook's fetch from overwriting the
 * value of another hook that asked for a different set of flags.
 */
export const featureFlagsByKeyAtom: Atom.Writable<Readonly<Record<string, FeatureFlagsResult>>> =
  Atom.make<Readonly<Record<string, FeatureFlagsResult>>>({});

const FeatureFlagKeysFromJson = Schema.fromJsonString(Schema.Array(Schema.String));
const encodeFeatureFlagKeys = Schema.encodeSync(FeatureFlagKeysFromJson);

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
