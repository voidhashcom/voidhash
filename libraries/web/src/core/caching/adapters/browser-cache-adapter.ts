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
      Effect.sync(() => {
        const memoryValue = memoryStore.get(key);
        if (memoryValue !== undefined) {
          return memoryValue;
        }

        if (localStorage) {
          try {
            const persistedValue = localStorage.getItem(key);
            if (persistedValue !== null) {
              memoryStore.set(key, persistedValue);
              return persistedValue;
            }
          } catch {
            // Graceful degradation
          }
        }

        return null;
      }),

    set: (key: string, value: string) =>
      Effect.sync(() => {
        memoryStore.set(key, value);

        if (localStorage) {
          try {
            localStorage.setItem(key, value);
          } catch {
            // Graceful degradation — storage may be full or unavailable
          }
        }
      }),

    delete: (key: string) =>
      Effect.sync(() => {
        memoryStore.delete(key);

        if (localStorage) {
          try {
            localStorage.removeItem(key);
          } catch {
            // Graceful degradation
          }
        }
      }),

    keys: () =>
      Effect.sync(() => {
        const keySet = new Set<string>(memoryStore.keys());

        if (localStorage) {
          try {
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key !== null) {
                keySet.add(key);
              }
            }
          } catch {
            // Graceful degradation
          }
        }

        return [...keySet] as ReadonlyArray<string>;
      }),
  };
};

const detectLocalStorage = (): Storage | null => {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  try {
    const probeKey = "__voidhash_probe__";
    window.localStorage.setItem(probeKey, "1");
    window.localStorage.removeItem(probeKey);
    return window.localStorage;
  } catch {
    return null;
  }
};

export const createBrowserCacheAdapterLayer = () =>
  Layer.effect(
    CacheAdapter,
    Effect.sync(() => makeBrowserCacheAdapter()),
  );
