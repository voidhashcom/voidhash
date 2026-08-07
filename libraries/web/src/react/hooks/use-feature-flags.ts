import { Effect } from "effect";
import React from "react";

import { VoidhashFeatureFlagsError } from "../../errors";
import type { FeatureFlagEntry, FeatureFlagsResult } from "../../types";
import { useVoidhash } from "./use-voidhash";

const ALL_KEYS = "all";

const serializeKeys = (keys?: ReadonlyArray<string>) => {
  if (keys && keys.length > 0) {
    return [...keys].sort().join(",");
  }

  return ALL_KEYS;
};

const deserializeKeys = (serializedKeys: string) => {
  if (serializedKeys === ALL_KEYS) {
    return undefined;
  }

  return serializedKeys.split(",");
};

const areEntriesEqual = (left: FeatureFlagEntry, right: FeatureFlagEntry) =>
  left.key === right.key &&
  left.enabled === right.enabled &&
  left.variantKey === right.variantKey &&
  left.payload === right.payload;

/** Structural comparison used to keep the previous state object when nothing changed. */
const areResultsEqual = (left: FeatureFlagsResult, right: FeatureFlagsResult) => {
  if (left.flags.length !== right.flags.length) {
    return false;
  }

  return left.flags.every((flag, index) => {
    const other = right.flags[index];
    if (!other) {
      return false;
    }

    return areEntriesEqual(flag, other);
  });
};

const toFeatureFlagsError = (cause: unknown, fallbackMessage: string) => {
  if (cause instanceof Error) {
    return cause;
  }

  return new VoidhashFeatureFlagsError(fallbackMessage, { cause });
};

export const useFeatureFlags = (keys?: string[]) => {
  const { client, distinctId, isInitialized } = useVoidhash();
  const [data, setData] = React.useState<FeatureFlagsResult>({ flags: [] });
  const [error, setError] = React.useState<Error | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const serializedKeys = React.useMemo(() => serializeKeys(keys), [keys]);
  const resolvedKeys = React.useMemo(() => deserializeKeys(serializedKeys), [serializedKeys]);

  const updateData = React.useCallback((nextData: FeatureFlagsResult) => {
    setData((previous) => {
      if (areResultsEqual(previous, nextData)) {
        return previous;
      }

      return nextData;
    });
  }, []);

  const refetch = React.useCallback(() => {
    setIsLoading(true);
    setError(null);

    return Effect.runPromise(
      Effect.tryPromise({
        try: () => client.refreshFeatureFlags(resolvedKeys),
        catch: (cause) => toFeatureFlagsError(cause, "Failed to refresh flags."),
      }).pipe(
        Effect.tap((nextData) => Effect.sync(() => updateData(nextData))),
        Effect.tapError((nextError) => Effect.sync(() => setError(nextError))),
        Effect.ensuring(Effect.sync(() => setIsLoading(false))),
      ),
    );
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
          setError(toFeatureFlagsError(cause, "Failed to load flags."));
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
  }, [client, distinctId, isInitialized, resolvedKeys, updateData]);

  React.useEffect(() => {
    return client.on("feature-flags-updated", (event) => {
      if (serializeKeys(event.keys) === serializedKeys) {
        updateData(event.result);
      }
    });
  }, [client, serializedKeys, updateData]);

  const isEnabled = React.useCallback(
    (key: string) => data.flags.find((flag) => flag.key === key)?.enabled ?? false,
    [data.flags],
  );

  const getVariant = React.useCallback(
    (key: string) => data.flags.find((flag) => flag.key === key) ?? null,
    [data.flags],
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
