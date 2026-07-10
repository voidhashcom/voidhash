import React, { useCallback, useMemo } from "react";

import type { VoidhashClient } from "../../client";
import { featureFlagsForKeysAtom } from "../../core/reactivity/client-state";
import type { VoidhashContext } from "../components/provider";
import useAsyncFunction from "./use-async-function";
import { useAtomValue } from "./use-atom-value";

export function featureFlagsHookFactory(
  client: VoidhashClient,
  vhContext: React.Context<VoidhashContext | null>,
) {
  function useFeatureFlags(flagKeys?: string[]) {
    const voidhashContext = React.useContext(vhContext);

    const fetchFlags = useCallback(() => client.getFeatureFlags(flagKeys), [flagKeys]);

    const { isLoading, error, refetch } = useAsyncFunction(fetchFlags, {
      enabled: voidhashContext?.isInitialized,
    });

    // Subscribe to only the slice of flag state matching our request. The
    // `featureFlagsForKeysAtom` family memoizes by normalized key so two
    // hooks asking for the same keys (in any order) share an atom, and hooks
    // asking for different keys can't trample each other.
    const flagsAtom = useMemo(() => featureFlagsForKeysAtom(flagKeys), [flagKeys]);
    const flags = useAtomValue(client.internal_getAtomRegistry(), flagsAtom);

    const isEnabled = useCallback(
      (key: string) => flags?.flags.find((f) => f.key === key)?.enabled ?? false,
      [flags],
    );

    const getVariant = useCallback(
      (key: string) => {
        const flag = flags?.flags.find((f) => f.key === key);
        return flag
          ? {
              enabled: flag.enabled,
              payload: flag.payload,
              variantKey: flag.variantKey,
            }
          : null;
      },
      [flags],
    );

    const data = useMemo(
      () => ({
        flags: flags?.flags ?? [],
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
