import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as HashSet from "effect/HashSet";

import { SdkConfiguration } from "../sdk-configuration";
import { CacheAdapter } from "./cache-adapter";

interface CacheEnvelope<T> {
  readonly createdAt: number;
  readonly expiresAt: Option.Option<number>;
  readonly staleAt: Option.Option<number>;
  readonly value: T;
}

export interface CacheHit<T> extends CacheEnvelope<T> {
  readonly isExpired: boolean;
  readonly isStale: boolean;
}

const CACHE_INDEX_SUFFIX = "__keys__";

const StorageKeyIndexFromJson = Schema.fromJsonString(Schema.Array(Schema.String));
const decodeStorageKeyIndex = Schema.decodeUnknownEffect(StorageKeyIndexFromJson);
const encodeStorageKeyIndex = Schema.encodeSync(StorageKeyIndexFromJson);

const EMPTY_STORAGE_KEYS: ReadonlyArray<string> = [];

/**
 * JSON codec for a cache envelope. The stored `value` is opaque to the cache
 * layer, so it is declared as an unvalidated pass-through of the caller's type.
 */
const cacheEnvelopeFromJson = <T>() =>
  Schema.fromJsonString(
    Schema.Struct({
      createdAt: Schema.Number,
      expiresAt: Schema.OptionFromNullOr(Schema.Number),
      staleAt: Schema.OptionFromNullOr(Schema.Number),
      value: Schema.declare((_value: unknown): _value is T => true),
    }),
  );

const hasElapsed = (timestamp: Option.Option<number>, now: number) =>
  Option.exists(timestamp, (value) => value < now);

const deadlineFrom = (now: number, offset?: number) => {
  if (!offset) {
    return Option.none();
  }
  return Option.some(now + offset);
};

const make = Effect.fn("makeCacheManager")(function* effect() {
  const cache = yield* CacheAdapter;
  const config = yield* SdkConfiguration;

  const namespace = `@voidhash/web:${config.publishableKey}:${config.baseUrl}`;
  const persistentIndexKey = `${namespace}:${CACHE_INDEX_SUFFIX}`;
  let memoryIndex = HashSet.empty<string>();

  const buildStorageKey = (key: string) => `${namespace}:${key}`;

  const loadIndexedStorageKeys = () =>
    Effect.gen(function* loadIndexedStorageKeys() {
      const rawIndex = yield* cache.get(persistentIndexKey);
      if (Option.isNone(rawIndex)) {
        return EMPTY_STORAGE_KEYS;
      }
      return yield* decodeStorageKeyIndex(rawIndex.value).pipe(
        Effect.orElseSucceed(() => EMPTY_STORAGE_KEYS),
      );
    });

  const persistIndex = () =>
    Effect.gen(function* persistIndex() {
      const serialized = encodeStorageKeyIndex(Array.from(memoryIndex));
      yield* cache.set(persistentIndexKey, serialized);
    });

  const rememberKey = (storageKey: string) =>
    Effect.gen(function* rememberKey() {
      if (storageKey === persistentIndexKey) {
        return;
      }
      memoryIndex = HashSet.add(memoryIndex, storageKey);
      yield* persistIndex();
    });

  const get = <T>(key: string) =>
    Effect.gen(function* get() {
      const storageKey = buildStorageKey(key);
      const rawValue = yield* cache.get(storageKey);

      if (Option.isNone(rawValue)) {
        return Option.none<CacheHit<T>>();
      }

      const cachedValue = yield* Schema.decodeUnknownEffect(cacheEnvelopeFromJson<T>())(
        rawValue.value,
      ).pipe(Effect.orDie);
      const now = yield* Clock.currentTimeMillis;
      const isExpired = hasElapsed(cachedValue.expiresAt, now);
      const isStale = hasElapsed(cachedValue.staleAt, now);

      if (isExpired) {
        yield* deleteValue(key);
        return Option.none<CacheHit<T>>();
      }

      yield* rememberKey(storageKey);

      return Option.some({
        ...cachedValue,
        isExpired,
        isStale,
      });
    });

  const setValue = <T>(key: string, value: T, options?: { staleTime?: number; ttl?: number }) =>
    Effect.gen(function* setValue() {
      const storageKey = buildStorageKey(key);
      const now = yield* Clock.currentTimeMillis;
      const envelope: CacheEnvelope<T> = {
        createdAt: now,
        expiresAt: deadlineFrom(now, options?.ttl),
        staleAt: deadlineFrom(now, options?.staleTime),
        value,
      };
      const serialized = Schema.encodeSync(cacheEnvelopeFromJson<T>())(envelope);
      yield* cache.set(storageKey, serialized);
      yield* rememberKey(storageKey);
    });

  const deleteValue = (key: string) =>
    Effect.gen(function* deleteValue() {
      const storageKey = buildStorageKey(key);
      yield* cache.delete(storageKey);
      memoryIndex = HashSet.remove(memoryIndex, storageKey);
      yield* persistIndex();
    });

  const clearAll = () =>
    Effect.gen(function* clearAll() {
      const keys = yield* getCacheKeys();
      yield* Effect.all(
        keys.map((key) => deleteValue(key)),
        { concurrency: 1 },
      );
    });

  const clearPrefix = (prefix: string) =>
    Effect.gen(function* clearPrefix() {
      const keys = yield* getCacheKeys();
      const matched = keys.filter((key) => key.startsWith(prefix));
      yield* Effect.all(
        matched.map((key) => deleteValue(key)),
        { concurrency: 1 },
      );
    });

  const getCacheKeys = () =>
    Effect.gen(function* getCacheKeys() {
      const storageKeys = yield* loadIndexedStorageKeys();
      const keys = HashSet.fromIterable([...memoryIndex, ...storageKeys]);
      return Array.from(keys)
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
  };
});

export class CacheManager extends Context.Service<
  CacheManager,
  Effect.Success<ReturnType<typeof make>>
>()("web-voidhash/CacheManager") {
  static Default = Layer.effect(CacheManager, make());
}
