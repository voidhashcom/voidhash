import { Effect, Layer } from "effect";

import { CacheAdapter } from "../cache-adapter";

/**
 * Dual-layer (memory + localStorage) browser cache adapter.
 * Writes go to both layers (write-through). Reads check memory first, fall back to localStorage.
 * Gracefully degrades when localStorage is unavailable.
 */
const makeBrowserCacheAdapter = () => {
  const memoryStore = new Map<string, string>();
  const localStorage = detectLocalStorage();

  return {
    get: (key: string) =>
      Effect.suspend(() => {
        const memoryValue = memoryStore.get(key);
        if (memoryValue !== undefined) {
          return Effect.succeed(memoryValue);
        }

        if (!localStorage) {
          return Effect.succeed(null);
        }

        return Effect.try({
          try: () => localStorage.getItem(key),
          catch: () => null,
        }).pipe(
          // Graceful degradation
          Effect.orElseSucceed(() => null),
          Effect.map((persistedValue) => {
            if (persistedValue === null) {
              return null;
            }

            memoryStore.set(key, persistedValue);
            return persistedValue;
          }),
        );
      }),

    set: (key: string, value: string) =>
      Effect.suspend(() => {
        memoryStore.set(key, value);

        if (!localStorage) {
          return Effect.void;
        }

        // Graceful degradation — storage may be full or unavailable
        return Effect.ignore(
          Effect.try({
            try: () => localStorage.setItem(key, value),
            catch: () => null,
          }),
        );
      }),

    delete: (key: string) =>
      Effect.suspend(() => {
        memoryStore.delete(key);

        if (!localStorage) {
          return Effect.void;
        }

        // Graceful degradation
        return Effect.ignore(
          Effect.try({
            try: () => localStorage.removeItem(key),
            catch: () => null,
          }),
        );
      }),

    keys: () =>
      Effect.suspend(() => {
        const keySet = new Set<string>(memoryStore.keys());

        if (!localStorage) {
          return Effect.succeed<ReadonlyArray<string>>([...keySet]);
        }

        return Effect.try({
          try: () => {
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key !== null) {
                keySet.add(key);
              }
            }
          },
          catch: () => null,
        }).pipe(
          // Graceful degradation
          Effect.ignore,
          Effect.map((): ReadonlyArray<string> => [...keySet]),
        );
      }),
  };
};

const detectLocalStorage = (): Storage | null => {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  return Effect.runSync(
    Effect.try({
      try: () => {
        const probeKey = "__voidhash_probe__";
        window.localStorage.setItem(probeKey, "1");
        window.localStorage.removeItem(probeKey);
        return window.localStorage;
      },
      catch: () => null,
    }).pipe(Effect.orElseSucceed((): Storage | null => null)),
  );
};

export const createBrowserCacheAdapterLayer = () =>
  Layer.effect(
    CacheAdapter,
    Effect.sync(() => makeBrowserCacheAdapter()),
  );
