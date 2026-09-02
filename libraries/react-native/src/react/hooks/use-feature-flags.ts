import React from "react";
import * as Option from "effect/Option";

import type { VoidhashClient } from "../../client";
import {
  featureFlagsForKeysAtom,
  normalizeFeatureFlagKeys,
} from "../../core/reactivity/client-state";
import type { VoidhashContext } from "../components/provider";
import useAsyncFunction from "./use-async-function";
import { useAtomValue } from "./use-atom-value";

export function featureFlagsHookFactory(
  client: VoidhashClient,
  vhContext: React.Context<Option.Option<VoidhashContext>>,
) {
  function useFeatureFlags(flagKeys?: string[]) {
    const voidhashContext = React.useContext(vhContext).valueOrUndefined;

    // Callers overwhelmingly pass an inline array literal, which is a fresh
    // identity on every render. Depending on it directly would restart the
    // fetch after every state update, so we key all downstream memoization on
    // the normalized signature instead and rebuild a stable array from it.
    const normalizedKeys = normalizeFeatureFlagKeys(flagKeys);
    const stableFlagKeys = React.useMemo(
      () => (normalizedKeys === "all" ? undefined : normalizedKeys.split(",")),
      [normalizedKeys],
    );

    const fetchFlags = React.useCallback(
      () => client.getFeatureFlags(stableFlagKeys),
      [stableFlagKeys],
    );

    const { isLoading, error, refetch } = useAsyncFunction(fetchFlags, {
      enabled: voidhashContext?.isInitialized,
    });

    // Subscribe to only the slice of flag state matching our request. The
    // `featureFlagsForKeysAtom` family memoizes by normalized key so two
    // hooks asking for the same keys (in any order) share an atom, and hooks
    // asking for different keys can't trample each other.
    const flagsAtom = React.useMemo(
      () => featureFlagsForKeysAtom(stableFlagKeys),
      [stableFlagKeys],
    );
    const flags = useAtomValue(client.internal.getAtomRegistry(), flagsAtom);

    const isEnabled = React.useCallback(
      (key: string) =>
        Option.exists(flags, (result) =>
          Option.exists(
            Option.fromUndefinedOr(result.flags.find((flag) => flag.key === key)),
            (flag) => flag.enabled,
          ),
        ),
      [flags],
    );

    const getVariant = React.useCallback(
      (key: string) =>
        Option.flatMap(flags, (result) =>
          Option.map(
            Option.fromUndefinedOr(result.flags.find((flag) => flag.key === key)),
            (flag) => ({
              enabled: flag.enabled,
              payload: flag.payload,
              variantKey: flag.variantKey,
            }),
          ),
        ),
      [flags],
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
      isEnabled,
      isLoading,
      refetch,
    };
  }
  return useFeatureFlags;
}
