import * as Effect from "effect/Effect";
import * as Arr from "effect/Array";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import React from "react";

import { VoidhashFeatureFlagsError } from "../../errors";
import type {
  FeatureFlagEntry,
  FeatureFlagKey,
  FeatureFlagsResult,
  FeatureFlagValue,
} from "../../types";
import { useVoidhash } from "./use-voidhash";

const ALL_KEYS = "all";

const serializeKeys = (keys?: ReadonlyArray<string>) => {
  if (keys && Arr.isReadonlyArrayNonEmpty(keys)) {
    return JSON.stringify(Arr.sort(keys, Str.Order));
  }

  return ALL_KEYS;
};

const deserializeKeys = (serializedKeys: string) => {
  if (serializedKeys === ALL_KEYS) {
    return undefined;
  }

  // Only ever the string `serializeKeys` produced above.
  const keys: Array<FeatureFlagKey> = JSON.parse(serializedKeys);
  return keys;
};

const areEntriesEqual = (left: FeatureFlagEntry, right: FeatureFlagEntry) =>
  left.key === right.key &&
  left.enabled === right.enabled &&
  left.variantKey === right.variantKey &&
  left.payload === right.payload;

/** Structural comparison used to keep the previous state object when nothing changed. */
const areResultsEqual = (left: FeatureFlagsResult, right: FeatureFlagsResult) => {
  if (left.isStale !== right.isStale || left.isExpired !== right.isExpired) {
    return false;
  }
  const leftMatches = left.flags.every((flag, index) => {
    const other = right.flags[index];
    if (!other) {
      return false;
    }

    return areEntriesEqual(flag, other);
  });
  const rightMatches = right.flags.every((flag, index) => {
    const other = left.flags[index];
    return other ? areEntriesEqual(flag, other) : false;
  });
  return leftMatches && rightMatches;
};

const toFeatureFlagsError = (cause: unknown, fallbackMessage: string) => {
  if (P.isError(cause)) {
    return cause;
  }

  return new VoidhashFeatureFlagsError(fallbackMessage, { cause });
};

/**
 * Evaluates `keys` (every flag when omitted) for the current visitor and
 * updates when a newer evaluation of the same keys lands.
 */
export const useFeatureFlags = (keys?: ReadonlyArray<FeatureFlagKey>) => {
  const { client, initError, isInitialized, status } = useVoidhash();
  const distinctId = client.peekDistinctId();
  const [data, setData] = React.useState<FeatureFlagsResult>({
    flags: [],
    isExpired: true,
    isStale: true,
  });
  // oxlint-disable-next-line effect/prefer-option-over-null -- the hook returns plain values, as the React Native SDK's hooks do.
  const [error, setError] = React.useState<Error | null>(null);
  // Loading until the first evaluation answers, including while the provider
  // is still starting, so a component can wait instead of rendering defaults.
  const [isLoading, setIsLoading] = React.useState(true);
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

    // oxlint-disable-next-line effect/effect-run-in-body -- the hook is where React awaits the refresh.
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
    // A client that failed to start evaluates nothing: stop loading and say
    // why, so the component renders its defaults. A retry loads again.
    if (status === "failed") {
      setIsLoading(false);
      setError(initError ?? null);
      return;
    }
    if (!isInitialized) {
      setIsLoading(true);
      setError(null);
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
  }, [client, distinctId, initError, isInitialized, resolvedKeys, status, updateData]);

  React.useEffect(() => {
    return client.on("feature-flags-updated", (event) => {
      // Flags of another person, evaluated before an identity switch, are not
      // this person's.
      if (serializeKeys(event.keys) === serializedKeys && event.distinctId === distinctId) {
        updateData(event.result);
      }
    });
  }, [client, distinctId, serializedKeys, updateData]);

  // A flag without an evaluated value reads as its configured default.
  const isEnabled = React.useCallback(
    (key: FeatureFlagKey) =>
      data.flags.find((flag) => flag.key === key)?.enabled ?? client.isFeatureEnabledByDefault(key),
    [client, data.flags],
  );

  const getVariant = React.useCallback(
    (key: FeatureFlagKey) => data.flags.find((flag) => flag.key === key) ?? null,
    [data.flags],
  );

  /**
   * The value of the variant a flag assigned: the variant's value, when it is
   * text and the flag is enabled. `null` while `isLoading`, so `null` with
   * `isLoading` means the flags are still loading, and `null` without it that
   * the flag is off, unknown, or its variant has no text value. Typed by the
   * variant values the generated declaration file lists for the flag; a
   * variant added since generation is not in that union.
   */
  const getVariantValue = React.useCallback(
    // oxlint-disable-next-line effect/prefer-option-over-null -- the hook returns plain values, as the React Native SDK's hooks do.
    <K extends FeatureFlagKey>(key: K): FeatureFlagValue<K> | null => {
      if (isLoading) return null;
      const flag = data.flags.find((entry) => entry.key === key);
      return flag?.enabled && P.isString(flag.payload) ? flag.payload : null;
    },
    [data.flags, isLoading],
  );

  return {
    data,
    error,
    getVariant,
    getVariantValue,
    isEnabled,
    /** `true` when the served flags were past their hard TTL. */
    isExpired: data.isExpired,
    isLoading,
    /** `true` when the served flags came from cache without a fresh refresh. */
    isStale: data.isStale,
    refetch,
  };
};
