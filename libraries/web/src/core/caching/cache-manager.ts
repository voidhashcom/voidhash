import { Effect, Layer, Context } from "effect";

import { SdkConfiguration } from "../sdk-configuration";
import { CacheAdapter } from "./cache-adapter";

interface CacheEnvelope<T> {
  readonly createdAt: number;
  readonly expiresAt: number | null;
  readonly staleAt: number | null;
  readonly value: T;
}

export interface CacheHit<T> extends CacheEnvelope<T> {
  readonly isExpired: boolean;
  readonly isStale: boolean;
}

const CACHE_INDEX_SUFFIX = "__keys__";

const make = Effect.gen(function* effect() {
  const cache = yield* CacheAdapter;
  const config = yield* SdkConfiguration;

  const namespace = `@voidhash/web:${config.publishableKey}:${config.baseUrl}`;
  const persistentIndexKey = `${namespace}:${CACHE_INDEX_SUFFIX}`;
  const memoryIndex = new Set<string>();

  const buildStorageKey = (key: string) => `${namespace}:${key}`;

  const loadIndexedStorageKeys = () =>
    Effect.gen(function* loadIndexedStorageKeys() {
      const rawIndex = yield* cache.get(persistentIndexKey);
      if (!rawIndex) {
        return [] as string[];
      }
      try {
        return JSON.parse(rawIndex) as string[];
      } catch {
        return [] as string[];
      }
    });

  const persistIndex = () =>
    Effect.gen(function* persistIndex() {
      const serialized = JSON.stringify([...memoryIndex]);
      yield* cache.set(persistentIndexKey, serialized);
    });

  const rememberKey = (storageKey: string) =>
    Effect.gen(function* rememberKey() {
      if (storageKey === persistentIndexKey) {
        return;
      }
      memoryIndex.add(storageKey);
      yield* persistIndex();
    });

  const get = <T>(key: string) =>
    Effect.gen(function* get() {
      const storageKey = buildStorageKey(key);
      const rawValue = yield* cache.get(storageKey);

      if (!rawValue) {
        return null as CacheHit<T> | null;
      }

      const cachedValue = JSON.parse(rawValue) as CacheEnvelope<T>;
      const isExpired =
        typeof cachedValue.expiresAt === "number"
          ? cachedValue.expiresAt < Date.now()
          : false;
      const isStale =
        typeof cachedValue.staleAt === "number"
          ? cachedValue.staleAt < Date.now()
          : false;

      if (isExpired) {
        yield* deleteValue(key);
        return null as CacheHit<T> | null;
      }

      yield* rememberKey(storageKey);

      return {
        ...cachedValue,
        isExpired,
        isStale,
      } as CacheHit<T>;
    });

  const setValue = <T>(
    key: string,
    value: T,
    options?: { staleTime?: number; ttl?: number }
  ) =>
    Effect.gen(function* setValue() {
      const storageKey = buildStorageKey(key);
      const envelope: CacheEnvelope<T> = {
        createdAt: Date.now(),
        expiresAt: options?.ttl ? Date.now() + options.ttl : null,
        staleAt: options?.staleTime ? Date.now() + options.staleTime : null,
        value,
      };
      const serialized = JSON.stringify(envelope);
      yield* cache.set(storageKey, serialized);
      yield* rememberKey(storageKey);
    });

  const deleteValue = (key: string) =>
    Effect.gen(function* deleteValue() {
      const storageKey = buildStorageKey(key);
      yield* cache.delete(storageKey);
      memoryIndex.delete(storageKey);
      yield* persistIndex();
    });

  const clearAll = () =>
    Effect.gen(function* clearAll() {
      const keys = yield* getCacheKeys();
      yield* Effect.all(keys.map((key) => deleteValue(key)));
    });

  const clearPrefix = (prefix: string) =>
    Effect.gen(function* clearPrefix() {
      const keys = yield* getCacheKeys();
      const matched = keys.filter((key) => key.startsWith(prefix));
      yield* Effect.all(matched.map((key) => deleteValue(key)));
    });

  const getCacheKeys = () =>
    Effect.gen(function* getCacheKeys() {
      const storageKeys = yield* loadIndexedStorageKeys();
      const keys = new Set<string>([...memoryIndex, ...storageKeys]);
      return [...keys]
        .filter((key) => key.startsWith(`${namespace}:`))
        .filter((key) => key !== persistentIndexKey)
        .map((key) => key.slice(namespace.length + 1));
    });

  return {
    clearAll,
    clearPrefix,
    delete: deleteValue,
    get,
    getCacheKeys,
    set: setValue,
  } as const;
});

export class CacheManager extends Context.Service<
  CacheManager,
  Effect.Success<typeof make>
>()("web-voidhash/CacheManager") {
  static Default = Layer.effect(CacheManager, make);
}
