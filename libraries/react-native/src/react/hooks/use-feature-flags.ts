import React, { useCallback, useEffect, useMemo, useState } from "react";

import type { VoidhashClient } from "../../client";
import type { FeatureFlagsFetchedEvent } from "../../core/event-bus";
import type { VoidhashSchema } from "../../core/schema";
import type { VoidhashContext } from "../components/provider";
import useAsyncFunction from "./use-async-function";

type FeatureFlagsResult = FeatureFlagsFetchedEvent;

export function featureFlagsHookFactory<TSchema extends VoidhashSchema>(
  client: VoidhashClient<TSchema>,
  vhContext: React.Context<VoidhashContext<TSchema> | null>
) {
  function useFeatureFlags(flagKeys?: string[]) {
    const voidhashContext = React.useContext(vhContext);
    const [flags, setFlags] = useState<FeatureFlagsResult | null>(null);

    const setFlagsIfDifferent = useCallback(
      (newFlags: FeatureFlagsResult | null) => {
        if (JSON.stringify(flags) === JSON.stringify(newFlags)) {
          return;
        }
        setFlags(newFlags);
      },
      [flags]
    );

    const fetchFlags = useCallback(
      () => client.getFeatureFlags(flagKeys),
      [flagKeys]
    );

    const {
      data: loadedFlags,
      isLoading,
      error,
      refetch,
    } = useAsyncFunction(fetchFlags, {
      enabled: voidhashContext?.isInitialized,
    });

    useEffect(() => {
      const eventBus = client.internal_getEventBus();
      const removeListener = eventBus.on(
        "feature-flags-fetched",
        (newFlags) => {
          setFlagsIfDifferent(newFlags);
        }
      );

      return () => {
        removeListener();
      };
    }, [setFlagsIfDifferent]);

    setFlagsIfDifferent(loadedFlags ?? null);

    const isEnabled = useCallback(
      (key: string) =>
        flags?.flags.find((f) => f.key === key)?.enabled ?? false,
      [flags]
    );

    const getVariant = useCallback(
      (key: string) => {
        const flag = flags?.flags.find((f) => f.key === key);
        return flag
          ? { enabled: flag.enabled, payload: flag.payload, variantKey: flag.variantKey }
          : null;
      },
      [flags]
    );

    const data = useMemo(
      () => ({
        flags: flags?.flags ?? [],
      }),
      [flags]
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
