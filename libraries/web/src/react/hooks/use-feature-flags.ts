import * as Effect from "effect/Effect";
import * as Arr from "effect/Array";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import * as Schema from "effect/Schema";
import * as Str from "effect/String";
import React from "react";

import { VoidhashFeatureFlagsError } from "../../errors";
import type { FeatureFlagEntry, FeatureFlagsResult } from "../../types";
import { useVoidhash } from "./use-voidhash";

const ALL_KEYS = "all";
const runtime = ManagedRuntime.make(Layer.empty);
const FlagKeysFromJson = Schema.fromJsonString(Schema.Array(Schema.String));
const encodeFlagKeys = Schema.encodeSync(FlagKeysFromJson);
const decodeFlagKeys = Schema.decodeUnknownSync(FlagKeysFromJson);

const serializeKeys = (keys?: ReadonlyArray<string>) => {
  if (keys && Arr.isReadonlyArrayNonEmpty(keys)) {
    return encodeFlagKeys(Arr.sort(keys, Str.Order));
  }

  return ALL_KEYS;
};

const deserializeKeys = (serializedKeys: string) => {
  if (serializedKeys === ALL_KEYS) {
    return undefined;
  }

  return [...decodeFlagKeys(serializedKeys)];
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

export const useFeatureFlags = (keys?: string[]) => {
  const { client, distinctId, isInitialized } = useVoidhash();
  const [data, setData] = React.useState<FeatureFlagsResult>({
    flags: [],
    isExpired: true,
    isStale: true,
  });
  const [error, setError] = React.useState<Option.Option<Error>>(Option.none());
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
    setError(Option.none());

    return runtime.runPromise(
      Effect.tryPromise({
        try: () => client.refreshFeatureFlags(resolvedKeys),
        catch: (cause) => toFeatureFlagsError(cause, "Failed to refresh flags."),
      }).pipe(
        Effect.tap((nextData) => Effect.sync(() => updateData(nextData))),
        Effect.tapError((nextError) => Effect.sync(() => setError(Option.some(nextError)))),
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
    setError(Option.none());

    void client
      .getFeatureFlags(resolvedKeys)
      .then((nextData) => {
        if (isMounted) {
          updateData(nextData);
        }
      })
      .catch((cause) => {
        if (isMounted) {
          setError(Option.some(toFeatureFlagsError(cause, "Failed to load flags.")));
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
    /** `true` when the served flags were past their hard TTL. */
    isExpired: data.isExpired,
    isLoading,
    /** `true` when the served flags came from cache without a fresh refresh. */
    isStale: data.isStale,
    refetch,
  };
};
