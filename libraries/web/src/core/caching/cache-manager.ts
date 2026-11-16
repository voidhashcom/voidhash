import * as Arr from "effect/Array";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";

import { Diagnostics } from "../diagnostics";
import { DEFAULT_BASE_URL } from "../constants";
import { isJsonObject, isStringArray, parseJson } from "../json";
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
 *
 * Version 2 keys the namespace by the publishable key alone. Version 1 also
 * used the API origin, so moving a site to a first-party proxy started every
 * returning visitor over as a new anonymous visitor.
 */
const CACHE_SCHEMA_VERSION = 2;

const FNV_OFFSET_BASIS = 0x81_1c_9d_c5;
const FNV_PRIME = 0x01_00_01_93;

/** Stable, short FNV-1a digest over UTF-8, shared with the native SDKs. */
export const digest = (input: string) =>
  Arr.reduce(
    Arr.fromIterable(new TextEncoder().encode(input)),
    FNV_OFFSET_BASIS,
    (hash, byte) => Math.imul(hash ^ byte, FNV_PRIME) >>> 0,
  )
    .toString(16)
    .padStart(8, "0");

const EMPTY_STORAGE_KEYS: ReadonlyArray<string> = [];

// oxlint-disable-next-line effect/prefer-option-over-null -- the JSON value as it arrives; decoders turn it into the SDK's types.
const isNullableNumber = (value: unknown): value is number | null =>
  value === null || P.isNumber(value);

/**
 * Reads a stored cache envelope. The stored `value` is opaque to the cache
 * layer and passes through as the caller's type; the caller checks it where
 * it can come from elsewhere.
 */
const decodeEnvelope = <T>(raw: string): Option.Option<CacheEnvelope<T>> =>
  Option.flatMap(parseJson(raw), (stored) => {
    if (!isJsonObject(stored) || !("value" in stored)) return Option.none();
    const { createdAt, expiresAt, staleAt } = stored;
    if (!P.isNumber(createdAt) || !isNullableNumber(expiresAt) || !isNullableNumber(staleAt)) {
      return Option.none();
    }
    // oxlint-disable-next-line effect/casting-awareness -- the cache stores values of any type and does not know the caller's; see the doc comment above.
    const value = stored.value as T;
    return Option.some({
      createdAt,
      expiresAt: Option.fromNullOr(expiresAt),
      staleAt: Option.fromNullOr(staleAt),
      value,
    });
  });

const encodeEnvelope = <T>(envelope: CacheEnvelope<T>) =>
  JSON.stringify({
    createdAt: envelope.createdAt,
    expiresAt: Option.getOrNull(envelope.expiresAt),
    staleAt: Option.getOrNull(envelope.staleAt),
    value: envelope.value,
  });

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

export const makeCacheManager = Effect.fnUntraced(function* makeCacheManager() {
  const cache = yield* CacheAdapter;
  const config = yield* SdkConfiguration;
  const diagnostics = yield* Diagnostics;

  const namespace = `vh:${CACHE_SCHEMA_VERSION}:${digest(config.publishableKey)}`;
  // Namespaces of earlier releases, consulted in order on a miss so an upgrade
  // keeps the identity, consent, queue, and cached flags. Each earlier scheme
  // is read for the current origin and for the default one, which covers
  // upgrading and moving to a first-party proxy in the same deploy. Read-only:
  // a hit is migrated into the current namespace.
  const previousNamespaces = Arr.dedupe([
    `vh:1:${digest(`${config.publishableKey}|${config.baseUrl}`)}`,
    `vh:1:${digest(`${config.publishableKey}|${DEFAULT_BASE_URL}`)}`,
    `@voidhash/web:${config.publishableKey}:${config.baseUrl}`,
    `@voidhash/web:${config.publishableKey}:${DEFAULT_BASE_URL}`,
  ]);
  const persistentIndexKey = `${namespace}:${CACHE_INDEX_SUFFIX}`;
  let memoryIndex = new Set<string>();
  // Keys deleted by this tab. Kept so merging the shared index back in cannot
  // resurrect them.
  const removedKeys = new Set<string>();

  const buildStorageKey = (key: string) => `${namespace}:${key}`;

  const loadIndexedStorageKeys = () =>
    Effect.gen(function* loadIndexedStorageKeys() {
      // Refreshed on purpose: the index is shared with the other tabs of this
      // origin, which append their own keys to it.
      const rawIndex = yield* cache.get(persistentIndexKey, { refresh: true });
      if (Option.isNone(rawIndex)) {
        return EMPTY_STORAGE_KEYS;
      }
      return Option.getOrElse(
        Option.filter(parseJson(rawIndex.value), isStringArray),
        () => EMPTY_STORAGE_KEYS,
      );
    });

  // The index is merged with what is already stored, so a tab never drops the
  // keys written by another tab.
  const persistIndex = () =>
    Effect.gen(function* persistIndex() {
      const storedKeys = yield* loadIndexedStorageKeys();
      const merged = new Set(
        [...memoryIndex, ...storedKeys].filter((storageKey) => !removedKeys.has(storageKey)),
      );
      memoryIndex = merged;
      yield* cache.set(persistentIndexKey, JSON.stringify(Array.from(merged)));
    });

  // The index is only written when it actually changed, so reads stay free.
  const rememberKey = (storageKey: string) =>
    Effect.gen(function* rememberKey() {
      if (storageKey === persistentIndexKey || memoryIndex.has(storageKey)) {
        return;
      }
      memoryIndex.add(storageKey);
      removedKeys.delete(storageKey);
      yield* persistIndex();
    });

  /**
   * Reads the current key and, on a miss, the same key in the namespaces of
   * earlier releases. A hit there is migrated in place: it is rewritten under
   * the current key and the old one is removed, so the fallback read happens
   * at most once per entry.
   */
  const readRaw = (key: string, options?: { readonly refresh?: boolean }) =>
    Effect.gen(function* readRaw() {
      const storageKey = buildStorageKey(key);
      const current = yield* cache.get(storageKey, options);
      if (Option.isSome(current)) {
        return current;
      }

      // The first namespace, in order, that still holds the key.
      const previous = yield* Effect.reduce(
        previousNamespaces,
        () => Option.none<{ readonly storageKey: string; readonly value: string }>(),
        (found, previousNamespace) => {
          if (Option.isSome(found)) return Effect.succeed(found);
          const previousStorageKey = `${previousNamespace}:${key}`;
          return Effect.map(
            cache.get(previousStorageKey, options),
            Option.map((value) => ({ storageKey: previousStorageKey, value })),
          );
        },
      );
      if (Option.isNone(previous)) {
        return Option.none<string>();
      }

      yield* cache.set(storageKey, previous.value.value);
      yield* cache.delete(previous.value.storageKey);
      yield* rememberKey(storageKey);
      return Option.some(previous.value.value);
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

      const decoded = decodeEnvelope<T>(rawValue.value);

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

  // Keys whose last write the device refused. A full storage refuses every
  // write until something frees space, so a key is reported when it starts
  // failing, not on each write: an app forwarding diagnostics to its error
  // tracker would otherwise get one per event.
  const failingKeys = new Set<string>();

  /**
   * Writes an entry and resolves with whether the device stored it. A refused
   * write keeps the value in memory for the page. With `isStale`, the entry
   * reads as stale at once, which a caller uses for a value it wants refreshed
   * before it is trusted.
   */
  const setValue = <T>(
    key: string,
    value: T,
    options?: { isStale?: boolean; staleTime?: number; ttl?: number },
  ) =>
    Effect.gen(function* setValue() {
      const storageKey = buildStorageKey(key);
      const now = yield* Clock.currentTimeMillis;
      const envelope: CacheEnvelope<T> = {
        createdAt: now,
        expiresAt: deadlineFrom(now, options?.ttl),
        staleAt: options?.isStale ? Option.some(now - 1) : deadlineFrom(now, options?.staleTime),
        value,
      };
      const serialized = encodeEnvelope(envelope);
      const persisted = yield* cache.set(storageKey, serialized);
      if (persisted) {
        failingKeys.delete(key);
      } else if (!failingKeys.has(key)) {
        failingKeys.add(key);
        yield* diagnostics.report({
          code: "CACHE_WRITE_FAILED",
          kind: "cache",
          message: `Could not persist cache entry "${key}"; it is kept in memory for this page.`,
          operation: "cache.set",
          retryable: false,
        });
      }
      yield* rememberKey(storageKey);
      return persisted;
    });

  const deleteValue = (key: string) =>
    Effect.gen(function* deleteValue() {
      const storageKey = buildStorageKey(key);
      yield* cache.delete(storageKey);
      yield* Effect.forEach(
        previousNamespaces,
        (previousNamespace) => cache.delete(`${previousNamespace}:${key}`),
        { concurrency: 1, discard: true },
      );
      memoryIndex.delete(storageKey);
      removedKeys.add(storageKey);
      yield* persistIndex();
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
      const keys = new Set([...memoryIndex, ...storageKeys, ...adapterKeys]);
      // Keys still in an earlier namespace count too, so an upgrade does not
      // orphan the queue segments other tabs left behind; reading one through
      // `get` migrates it.
      return Arr.dedupe(
        Arr.flatMap(Array.from(keys), (storageKey) =>
          Arr.filterMap([namespace, ...previousNamespaces], (candidate) =>
            storageKey.startsWith(`${candidate}:`) &&
            storageKey !== `${candidate}:${CACHE_INDEX_SUFFIX}`
              ? Result.succeed(storageKey.slice(candidate.length + 1))
              : Result.failVoid,
          ),
        ),
      );
    });

  /**
   * Takes every entry `isKept` does not keep off the device. The page keeps
   * reading them from memory; the device holds nothing of them until the
   * adapter's `persistHeld` writes them back.
   */
  const holdInMemory = (isKept: (key: string) => boolean) =>
    Effect.gen(function* holdInMemory() {
      const keys = Arr.filter(yield* getCacheKeys(), (key) => !isKept(key));
      yield* Effect.forEach(
        keys,
        // Read first, so an entry of an earlier namespace is moved into memory too.
        (key) => Effect.andThen(readRaw(key), cache.holdInMemory(buildStorageKey(key))),
        { concurrency: 1, discard: true },
      );
      yield* cache.holdInMemory(persistentIndexKey);
    });

  return {
    clearPrefix,
    delete: deleteValue,
    get,
    getCacheKeys,
    holdInMemory,
    set: setValue,
    /** How much of the device's storage the entry takes, in UTF-16 code units. */
    storedLength: (key: string) => cache.storedLength(buildStorageKey(key)),
  };
});

export class CacheManager extends Context.Service<
  CacheManager,
  Effect.Success<ReturnType<typeof makeCacheManager>>
>()("web-voidhash/CacheManager") {}
