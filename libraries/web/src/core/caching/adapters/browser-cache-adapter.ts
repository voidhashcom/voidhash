import * as P from "effect/Predicate";
import * as Effect from "effect/Effect";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Result from "effect/Result";

import type { CacheAdapter } from "../cache-adapter";

/**
 * Dual-layer (memory + localStorage) browser cache adapter.
 * Writes go to both layers (write-through). Reads check memory first, fall back to localStorage.
 * Gracefully degrades when localStorage is unavailable. A key `mayPersist`
 * refuses is kept in memory only, until {@link CacheAdapter} `persistHeld`.
 */
export const makeBrowserCacheAdapter = (options?: {
  readonly mayPersist?: (key: string) => boolean;
}): CacheAdapter["Service"] => {
  const mayPersist = options?.mayPersist ?? (() => true);
  const memoryStore = new Map<string, string>();
  // Keys held only in memory: their last write failed, or the device may not
  // hold them yet. Memory stays authoritative for them: an empty backing store
  // means "the write never landed", not "another tab removed the value", so a
  // refreshing read must not discard the value.
  const unpersistedKeys = new Set<string>();
  const localStorage = detectLocalStorage();

  return {
    get: (key: string, options?: { readonly refresh?: boolean }) =>
      Effect.suspend(() => {
        const memoryValue = Option.fromUndefinedOr(memoryStore.get(key));
        if (Option.isSome(memoryValue) && !options?.refresh) {
          return Effect.succeed(Option.some(memoryValue.value));
        }

        // While the device may not hold a key, an empty slot there says
        // nothing about the value, so memory stays authoritative.
        if (Option.isNone(localStorage) || unpersistedKeys.has(key) || !mayPersist(key)) {
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
                memoryStore.delete(key);
                return Option.none();
              }
              return memoryValue;
            }

            memoryStore.set(key, persistedValue.value);
            return Option.some(persistedValue.value);
          }),
        );
      }),

    set: (key: string, value: string) =>
      Effect.suspend(() => {
        memoryStore.set(key, value);

        if (Option.isNone(localStorage)) {
          return Effect.succeed(false);
        }

        if (!mayPersist(key)) {
          unpersistedKeys.add(key);
          Result.try({ try: () => localStorage.value.removeItem(key), catch: (error) => error });
          return Effect.succeed(true);
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
            if (persisted) {
              unpersistedKeys.delete(key);
            } else {
              unpersistedKeys.add(key);
            }
            return persisted;
          }),
        );
      }),

    delete: (key: string) =>
      Effect.suspend(() => {
        memoryStore.delete(key);
        unpersistedKeys.delete(key);

        if (Option.isNone(localStorage)) {
          return Effect.void;
        }

        // Graceful degradation
        return Effect.catch(
          Effect.try({
            try: () => localStorage.value.removeItem(key),
            catch: (error) => error,
          }),
          () => Effect.void,
        );
      }),

    keys: () =>
      Effect.suspend(() => {
        const keySet = new Set(memoryStore.keys());

        if (Option.isNone(localStorage)) {
          return Effect.succeed<ReadonlyArray<string>>(Array.from(keySet));
        }

        return Effect.try({
          try: () => {
            Arr.forEach(
              Arr.getSomes(
                Arr.map(Arr.range(0, localStorage.value.length - 1), (index) =>
                  Option.fromNullishOr(localStorage.value.key(index)),
                ),
              ),
              (key) => keySet.add(key),
            );
          },
          catch: (error) => error,
        }).pipe(
          // Graceful degradation
          Effect.catch(() => Effect.void),
          Effect.map((): ReadonlyArray<string> => Array.from(keySet)),
        );
      }),

    // Reads the backing store itself: after a refused write, the copy an
    // earlier write left there still takes its space.
    storedLength: (key: string) =>
      Effect.sync(() => {
        if (Option.isNone(localStorage)) return 0;
        const stored = Result.try({
          try: () => localStorage.value.getItem(key),
          catch: (error) => error,
        });
        return Option.match(Option.flatMap(Result.getSuccess(stored), Option.fromNullishOr), {
          onNone: () => 0,
          onSome: (value) => key.length + value.length,
        });
      }),

    holdInMemory: (key: string) =>
      Effect.sync(() => {
        if (Option.isNone(localStorage)) return;
        if (!memoryStore.has(key)) {
          const stored = Result.try({
            try: () => localStorage.value.getItem(key),
            catch: (error) => error,
          });
          Option.map(Option.flatMap(Result.getSuccess(stored), Option.fromNullishOr), (value) =>
            memoryStore.set(key, value),
          );
        }
        if (memoryStore.has(key)) unpersistedKeys.add(key);
        Result.try({ try: () => localStorage.value.removeItem(key), catch: (error) => error });
      }),

    persistHeld: (persistOptions: { readonly preferStored: boolean }) =>
      Effect.sync(() => {
        if (Option.isNone(localStorage)) return;
        Arr.forEach(Array.from(unpersistedKeys), (key) => {
          const value = memoryStore.get(key);
          if (value === undefined || !mayPersist(key)) return;
          if (persistOptions.preferStored) {
            const stored = Option.flatMap(
              Result.getSuccess(
                Result.try({ try: () => localStorage.value.getItem(key), catch: (error) => error }),
              ),
              Option.fromNullishOr,
            );
            if (Option.isSome(stored)) {
              memoryStore.set(key, stored.value);
              unpersistedKeys.delete(key);
              return;
            }
          }
          const written = Result.try({
            try: () => localStorage.value.setItem(key, value),
            catch: (error) => error,
          });
          if (Result.isSuccess(written)) unpersistedKeys.delete(key);
        });
      }),
  };
};

/**
 * Returns `localStorage` when it can be written. Reading the property itself
 * throws a `SecurityError` when the browser blocks storage for the site, so
 * the access happens inside the guard too.
 */
const detectLocalStorage = (): Option.Option<Storage> => {
  if (P.isUndefined(globalThis.window)) {
    return Option.none();
  }

  return Result.try({
    try: () => {
      const storage = window.localStorage;
      const probeKey = "__voidhash_probe__";
      storage.setItem(probeKey, "1");
      storage.removeItem(probeKey);
      return Option.some(storage);
    },
    catch: (error) => error,
  }).pipe(Result.getOrElse(() => Option.none()));
};
