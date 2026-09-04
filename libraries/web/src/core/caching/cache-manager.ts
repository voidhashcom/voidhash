import * as Arr from "effect/Array";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as HashSet from "effect/HashSet";

import { Diagnostics } from "../diagnostics";
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

/**
 * Bumping this discards or migrates the whole namespace in a future release
 * without heuristics. It is never derived from the app version.
 */
const CACHE_SCHEMA_VERSION = 1;

const FNV_OFFSET_BASIS = 0x81_1c_9d_c5;
const FNV_PRIME = 0x01_00_01_93;

/** Stable, short FNV-1a digest over UTF-8, shared with the native SDKs. */
const digest = (input: string) =>
  Arr.reduce(
    Arr.fromIterable(new TextEncoder().encode(input)),
    FNV_OFFSET_BASIS,
    (hash, byte) => Math.imul(hash ^ byte, FNV_PRIME) >>> 0,
  )
    .toString(16)
    .padStart(8, "0");

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

/**
 * Turns a relative offset into an absolute deadline. An absent or zero offset
 * means "no deadline": entries written that way never go stale or expire, which
 * is how values that must be served indefinitely (feature flags, the analytics
 * queue) are stored.
 */
const deadlineFrom = (now: number, offset?: number) => {
  if (!offset) {
    return Option.none();
  }
  return Option.some(now + offset);
};

const make = Effect.fn("makeCacheManager")(function* effect() {
  const cache = yield* CacheAdapter;
  const config = yield* SdkConfiguration;
  const diagnostics = yield* Diagnostics;

  const namespace = `vh:${CACHE_SCHEMA_VERSION}:${digest(`${config.publishableKey}|${config.baseUrl}`)}`;
  // Namespace used by SDK releases before the versioned scheme. Read-only: it
  // is consulted on a miss so an upgrade keeps the queue and the cached flags.
  const legacyNamespace = `@voidhash/web:${config.publishableKey}:${config.baseUrl}`;
  const persistentIndexKey = `${namespace}:${CACHE_INDEX_SUFFIX}`;
  let memoryIndex = HashSet.empty<string>();
  // Keys deleted by this tab. Kept so merging the shared index back in cannot
  // resurrect them.
  let removedKeys = HashSet.empty<string>();

  const buildStorageKey = (key: string) => `${namespace}:${key}`;

  const loadIndexedStorageKeys = () =>
    Effect.gen(function* loadIndexedStorageKeys() {
      // Refreshed on purpose: the index is shared with the other tabs of this
      // origin, which append their own keys to it.
      const rawIndex = yield* cache.get(persistentIndexKey, { refresh: true });
      if (Option.isNone(rawIndex)) {
        return EMPTY_STORAGE_KEYS;
      }
      return yield* decodeStorageKeyIndex(rawIndex.value).pipe(
        Effect.orElseSucceed(() => EMPTY_STORAGE_KEYS),
      );
    });

  // The index is merged with what is already stored, so a tab never drops the
  // keys written by another tab.
  const persistIndex = () =>
    Effect.gen(function* persistIndex() {
      const storedKeys = yield* loadIndexedStorageKeys();
      const merged = HashSet.difference(
        HashSet.union(memoryIndex, HashSet.fromIterable(storedKeys)),
        removedKeys,
      );
      memoryIndex = merged;
      yield* cache.set(persistentIndexKey, encodeStorageKeyIndex(Array.from(merged)));
    });

  // The index is only written when it actually changed, so reads stay free.
  const rememberKey = (storageKey: string) =>
    Effect.gen(function* rememberKey() {
      if (storageKey === persistentIndexKey || HashSet.has(memoryIndex, storageKey)) {
        return;
      }
      memoryIndex = HashSet.add(memoryIndex, storageKey);
      removedKeys = HashSet.remove(removedKeys, storageKey);
      yield* persistIndex();
    });

  /**
   * Reads the current key and, on a miss, the key written by SDK releases
   * before the versioned namespace. A legacy hit is migrated in place: it is
   * rewritten under the current key and the old one is removed, so the fallback
   * read happens at most once per entry.
   */
  const readRaw = (key: string, options?: { readonly refresh?: boolean }) =>
    Effect.gen(function* readRaw() {
      const storageKey = buildStorageKey(key);
      const current = yield* cache.get(storageKey, options);
      if (Option.isSome(current)) {
        return current;
      }

      const legacyStorageKey = `${legacyNamespace}:${key}`;
      const legacy = yield* cache.get(legacyStorageKey, options);
      if (Option.isNone(legacy)) {
        return legacy;
      }

      yield* cache.set(storageKey, legacy.value);
      yield* cache.delete(legacyStorageKey);
      yield* rememberKey(storageKey);
      return legacy;
    });

  /**
   * Reads a cache entry. Expired entries are returned with `isExpired` set
   * instead of being dropped: TTL drives refresh urgency, not availability.
   * `options.refresh` re-reads the backing store, bypassing the memory layer.
   */
  const get = <T>(key: string, options?: { readonly refresh?: boolean }) =>
    Effect.gen(function* get() {
      const storageKey = buildStorageKey(key);
      const rawValue = yield* readRaw(key, options);

      if (Option.isNone(rawValue)) {
        return Option.none<CacheHit<T>>();
      }

      const decoded = yield* Effect.option(
        Schema.decodeUnknownEffect(cacheEnvelopeFromJson<T>())(rawValue.value),
      );

      if (Option.isNone(decoded)) {
        yield* diagnostics.report({
          code: "CACHE_READ_FAILED",
          kind: "cache",
          message: `Discarding unreadable cache entry "${key}".`,
          operation: "cache.get",
          retryable: false,
        });
        yield* deleteValue(key);
        return Option.none<CacheHit<T>>();
      }

      const cachedValue = decoded.value;
      const now = yield* Clock.currentTimeMillis;

      yield* rememberKey(storageKey);

      return Option.some({
        ...cachedValue,
        isExpired: hasElapsed(cachedValue.expiresAt, now),
        isStale: hasElapsed(cachedValue.expiresAt, now) || hasElapsed(cachedValue.staleAt, now),
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
      const persisted = yield* cache.set(storageKey, serialized);
      if (!persisted) {
        yield* diagnostics.report({
          code: "CACHE_WRITE_FAILED",
          kind: "cache",
          message: `Could not persist cache entry "${key}"; it is kept in memory for this page.`,
          operation: "cache.set",
          retryable: false,
        });
      }
      yield* rememberKey(storageKey);
    });

  const deleteValue = (key: string) =>
    Effect.gen(function* deleteValue() {
      const storageKey = buildStorageKey(key);
      yield* cache.delete(storageKey);
      yield* cache.delete(`${legacyNamespace}:${key}`);
      memoryIndex = HashSet.remove(memoryIndex, storageKey);
      removedKeys = HashSet.add(removedKeys, storageKey);
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
      // The shared index is an optimization, not the source of truth. Its
      // read/merge/write update cannot be atomic across tabs, so a concurrent
      // writer may temporarily omit another tab's key. Enumerating the adapter
      // keeps orphan queues discoverable and repairs clear-by-prefix behavior.
      const adapterKeys = yield* cache.keys();
      const keys = HashSet.fromIterable([...memoryIndex, ...storageKeys, ...adapterKeys]);
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
