import * as P from "effect/Predicate";
import * as Effect from "effect/Effect";
import * as Arr from "effect/Array";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Result from "effect/Result";

import { CacheAdapter } from "../cache-adapter";

/**
 * Dual-layer (memory + localStorage) browser cache adapter.
 * Writes go to both layers (write-through). Reads check memory first, fall back to localStorage.
 * Gracefully degrades when localStorage is unavailable.
 */
const makeBrowserCacheAdapter = () => {
  let memoryStore = HashMap.empty<string, string>();
  // Keys whose last persistence attempt failed. Memory stays authoritative for
  // them: an empty backing store means "the write never landed", not "another
  // tab removed the value", so a refreshing read must not discard the value.
  let unpersistedKeys = HashSet.empty<string>();
  const localStorage = detectLocalStorage();

  return {
    get: (key: string, options?: { readonly refresh?: boolean }) =>
      Effect.suspend(() => {
        const memoryValue = HashMap.get(memoryStore, key);
        if (Option.isSome(memoryValue) && !options?.refresh) {
          return Effect.succeed(Option.some(memoryValue.value));
        }

        if (Option.isNone(localStorage) || HashSet.has(unpersistedKeys, key)) {
          return Effect.succeed(memoryValue);
        }

        return Effect.try({
          try: () => localStorage.value.getItem(key),
          catch: (error) => error,
        }).pipe(
          Effect.option,
          Effect.map((persistedValue) => {
            if (Option.isNone(persistedValue) || persistedValue.value === null) {
              if (options?.refresh) {
                memoryStore = HashMap.remove(memoryStore, key);
                return Option.none();
              }
              return memoryValue;
            }

            memoryStore = HashMap.set(memoryStore, key, persistedValue.value);
            return Option.some(persistedValue.value);
          }),
        );
      }),

    set: (key: string, value: string) =>
      Effect.suspend(() => {
        memoryStore = HashMap.set(memoryStore, key, value);

        if (Option.isNone(localStorage)) {
          return Effect.succeed(false);
        }

        return Effect.try({
          try: () => {
            localStorage.value.setItem(key, value);
            return true;
          },
          catch: (error) => error,
        }).pipe(
          Effect.orElseSucceed(() => false),
          Effect.map((persisted) => {
            unpersistedKeys = persisted
              ? HashSet.remove(unpersistedKeys, key)
              : HashSet.add(unpersistedKeys, key);
            return persisted;
          }),
        );
      }),

    delete: (key: string) =>
      Effect.suspend(() => {
        memoryStore = HashMap.remove(memoryStore, key);
        unpersistedKeys = HashSet.remove(unpersistedKeys, key);

        if (Option.isNone(localStorage)) {
          return Effect.void;
        }

        // Graceful degradation
        return Effect.ignore(
          Effect.try({
            try: () => localStorage.value.removeItem(key),
            catch: (error) => error,
          }),
        );
      }),

    keys: () =>
      Effect.suspend(() => {
        let keySet = HashSet.fromIterable(HashMap.keys(memoryStore));

        if (Option.isNone(localStorage)) {
          return Effect.succeed<ReadonlyArray<string>>(Array.from(keySet));
        }

        return Effect.try({
          try: () => {
            keySet = HashSet.union(
              keySet,
              HashSet.fromIterable(
                Arr.getSomes(
                  Arr.map(Arr.range(0, localStorage.value.length - 1), (index) =>
                    Option.fromNullishOr(localStorage.value.key(index)),
                  ),
                ),
              ),
            );
          },
          catch: (error) => error,
        }).pipe(
          // Graceful degradation
          Effect.ignore,
          Effect.map((): ReadonlyArray<string> => Array.from(keySet)),
        );
      }),
  };
};

const detectLocalStorage = (): Option.Option<Storage> => {
  if (P.isUndefined(window) || !window.localStorage) {
    return Option.none();
  }

  return Result.try({
    try: () => {
      const probeKey = "__voidhash_probe__";
      window.localStorage.setItem(probeKey, "1");
      window.localStorage.removeItem(probeKey);
      return Option.some(window.localStorage);
    },
    catch: (error) => error,
  }).pipe(Result.getOrElse(() => Option.none()));
};

export const createBrowserCacheAdapterLayer = () =>
  Layer.effect(
    CacheAdapter,
    Effect.sync(() => makeBrowserCacheAdapter()),
  );
