import React from "react";

import type { FeatureFlagsResult } from "../../types";
import { useVoidhash } from "./use-voidhash";

const serializeKeys = (keys?: ReadonlyArray<string>) =>
  keys && keys.length > 0 ? [...keys].sort().join(",") : "all";

export const useFeatureFlags = (keys?: string[]) => {
  const { appUserId, client, isInitialized } = useVoidhash();
  const [data, setData] = React.useState<FeatureFlagsResult>({ flags: [] });
  const [error, setError] = React.useState<Error | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const serializedKeys = React.useMemo(() => serializeKeys(keys), [keys]);
  const resolvedKeys = React.useMemo(
    () => (serializedKeys === "all" ? undefined : serializedKeys.split(",")),
    [serializedKeys]
  );

  const updateData = React.useCallback((nextData: FeatureFlagsResult) => {
    setData((previous) =>
      JSON.stringify(previous) === JSON.stringify(nextData) ? previous : nextData
    );
  }, []);

  const refetch = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const nextData = await client.refreshFeatureFlags(resolvedKeys);
      updateData(nextData);
      return nextData;
    } catch (cause) {
      const nextError =
        cause instanceof Error ? cause : new Error("Failed to refresh flags.");
      setError(nextError);
      throw nextError;
    } finally {
      setIsLoading(false);
    }
  }, [client, resolvedKeys, updateData]);

  React.useEffect(() => {
    if (!isInitialized) {
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    void client
      .getFeatureFlags(resolvedKeys)
      .then((nextData) => {
        if (isMounted) {
          updateData(nextData);
        }
      })
      .catch((cause) => {
        if (isMounted) {
          setError(
            cause instanceof Error ? cause : new Error("Failed to load flags.")
          );
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [appUserId, client, isInitialized, resolvedKeys, updateData]);

  React.useEffect(() => {
    return client.on("feature-flags-updated", (event) => {
      if (serializeKeys(event.keys) === serializedKeys) {
        updateData(event.result);
      }
    });
  }, [client, serializedKeys, updateData]);

  const isEnabled = React.useCallback(
    (key: string) => data.flags.find((flag) => flag.key === key)?.enabled ?? false,
    [data.flags]
  );

  const getVariant = React.useCallback(
    (key: string) => data.flags.find((flag) => flag.key === key) ?? null,
    [data.flags]
  );

  return {
    data,
    error,
    getVariant,
    isEnabled,
    isLoading,
    refetch,
  };
};
