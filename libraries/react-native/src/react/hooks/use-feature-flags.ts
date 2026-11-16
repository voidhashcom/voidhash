import React from "react";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";

import type { VoidhashClient } from "../../client";
import type { SdkFeatureFlag } from "../../core/facade-types";
import type { FeatureFlagKey, FeatureFlagValue } from "../../core/schema/registry";
import {
  decodeFeatureFlagKeys,
  featureFlagsForKeysAtom,
  identityEpochAtom,
  normalizeFeatureFlagKeys,
} from "../../core/reactivity/client-state";
import type { VoidhashError } from "../../errors";
import { type VoidhashContext, useProviderStatus } from "../components/provider";
import useAsyncFunction from "./use-async-function";
import { useAtomValue } from "./use-atom-value";

/** One flag's evaluation as {@link UseFeatureFlagsResult.getVariant} reports it. */
export interface FeatureFlagVariant {
  enabled: boolean;
  /** The selected variant's key, or `null` for a flag without variants. */
  // oxlint-disable-next-line effect/prefer-option-over-null -- public hook answer consumed by non-Effect app code.
  variantKey: string | null;
  /** The selected variant's payload: untyped JSON, `null` when it has none. Validate before use. */
  payload: unknown;
}

export interface UseFeatureFlagsResult {
  data: {
    /** Every flag evaluated for the requested keys (all flags when none were passed). */
    flags: ReadonlyArray<SdkFeatureFlag>;
  };
  /** The error that stopped the last evaluation, or `null`. */
  // oxlint-disable-next-line effect/prefer-option-over-null -- public hook answer consumed by non-Effect app code.
  error: VoidhashError | null;
  /** The flag's variant, or `null` while it is loading or unknown. */
  // oxlint-disable-next-line effect/prefer-option-over-null -- public hook answer consumed by non-Effect app code.
  getVariant: (key: FeatureFlagKey) => FeatureFlagVariant | null;
  /**
   * The value of the variant the flag selected, while the flag is enabled:
   * `null` while loading (`isLoading`), and once loaded when the flag is
   * off, has no variant (or one whose value is not text) or is unknown.
   * Typed by the variant values `voidhash.gen.d.ts` lists for the flag; a
   * variant added since generation is not in that union.
   */
  // oxlint-disable-next-line effect/prefer-option-over-null -- public hook answer consumed by non-Effect app code.
  getVariantValue: <K extends FeatureFlagKey>(key: K) => FeatureFlagValue<K> | null;
  /**
   * Whether the flag is enabled. A flag without an evaluated value (while
   * loading, unknown, or on a disabled client) reads as its
   * `featureFlags.defaults` entry, or `false`.
   */
  isEnabled: (key: FeatureFlagKey) => boolean;
  /** `true` while the provider initializes and until this hook's evaluation has answered. */
  isLoading: boolean;
  refetch: () => Promise<void>;
}

export function featureFlagsHookFactory(
  client: VoidhashClient,
  vhContext: React.Context<Option.Option<VoidhashContext>>,
) {
  /**
   * Evaluates `flagKeys` (every flag when omitted) for the current person and
   * re-renders when a newer evaluation lands, including after `identify()` or
   * `reset()` switches the person.
   */
  function useFeatureFlags(flagKeys?: ReadonlyArray<FeatureFlagKey>): UseFeatureFlagsResult {
    const status = useProviderStatus(vhContext, "useFeatureFlags");
    const registry = client.internal.getAtomRegistry();
    const identityEpoch = useAtomValue(registry, identityEpochAtom);

    // Callers overwhelmingly pass an inline array literal, which is a fresh
    // identity on every render. Depending on it directly would restart the
    // fetch after every state update, so everything downstream is keyed on
    // the normalized signature and the keys are read back from it.
    const normalizedKeys = normalizeFeatureFlagKeys(flagKeys);
    const stableFlagKeys = React.useMemo(
      () => (normalizedKeys === "all" ? undefined : decodeFeatureFlagKeys(normalizedKeys)),
      [normalizedKeys],
    );

    // The identity epoch is a dependency so a mounted hook evaluates again
    // for the person an `identify()` or `reset()` switched to.
    const fetchFlags = React.useCallback(
      () => client.getFeatureFlags(stableFlagKeys),
      // oxlint-disable-next-line react-hooks/exhaustive-deps -- identityEpoch is the refetch trigger, not an input of the call.
      [stableFlagKeys, identityEpoch],
    );

    const { isLoading, error, refetch } = useAsyncFunction(fetchFlags, status);

    // Subscribe to only the slice of flag state matching our request. The
    // `featureFlagsForKeysAtom` family memoizes by normalized key so two
    // hooks asking for the same keys (in any order) share an atom, and hooks
    // asking for different keys can't trample each other.
    const flagsAtom = React.useMemo(
      () => featureFlagsForKeysAtom(stableFlagKeys),
      [stableFlagKeys],
    );
    const flags = useAtomValue(registry, flagsAtom);

    const findFlag = React.useCallback(
      (key: string) =>
        Option.flatMap(flags, (result) =>
          Option.fromUndefinedOr(result.flags.find((flag) => flag.key === key)),
        ),
      [flags],
    );

    const isEnabled = React.useCallback(
      (key: string) =>
        Option.match(findFlag(key), {
          onNone: () => client.internal.isFeatureEnabledByDefault(key),
          onSome: (flag) => flag.enabled,
        }),
      [findFlag],
    );

    const getVariantValue = React.useCallback(
      // oxlint-disable-next-line effect/prefer-option-over-null -- public hook answer consumed by non-Effect app code.
      <K extends FeatureFlagKey>(key: K): FeatureFlagValue<K> | null => {
        if (isLoading) return null;
        const flag = findFlag(key);
        return Option.isSome(flag) && flag.value.enabled && P.isString(flag.value.payload)
          ? flag.value.payload
          : null;
      },
      [findFlag, isLoading],
    );

    const getVariant = React.useCallback(
      // oxlint-disable-next-line effect/prefer-option-over-null -- public hook answer consumed by non-Effect app code.
      (key: string): FeatureFlagVariant | null =>
        Option.getOrNull(
          Option.map(findFlag(key), (flag) => ({
            enabled: flag.enabled,
            payload: flag.payload,
            variantKey: flag.variantKey,
          })),
        ),
      [findFlag],
    );

    const data = React.useMemo(
      () => ({
        flags: Option.match(flags, { onNone: () => [], onSome: (result) => result.flags }),
      }),
      [flags],
    );

    return {
      data,
      error,
      getVariant,
      getVariantValue,
      isEnabled,
      isLoading,
      refetch,
    };
  }
  return useFeatureFlags;
}
