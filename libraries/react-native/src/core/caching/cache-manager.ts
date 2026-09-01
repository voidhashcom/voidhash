import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";

import { CacheAdapter } from "./cache-adapter";

const CACHE_KEYS_KEY = "cache-keys";

interface CacheEnvelope<T> {
  readonly value: T;
  readonly expiresAt: Option.Option<number>;
  readonly createdAt: number;
  readonly staleAt: Option.Option<number>;
}

export interface CacheHit<T> extends CacheEnvelope<T> {
  readonly isStale: boolean;
  readonly isExpired: boolean;
}

const storageKeysFromJson = Schema.fromJsonString(Schema.Array(Schema.String));

const cacheEnvelopeFromJson = <T>() =>
  Schema.fromJsonString(
    Schema.Struct({
      createdAt: Schema.Number,
      expiresAt: Schema.OptionFromNullOr(Schema.Number),
      staleAt: Schema.OptionFromNullOr(Schema.Number),
      value: Schema.declare((_value: unknown): _value is T => true),
    }),
  );

const deadlineFrom = (now: number, offset: Option.Option<number>) =>
  Option.map(offset, (value) => now + value);

const make = Effect.fn("makeCacheManager")(function* effect() {
  const cache = yield* CacheAdapter;
  const cacheKeysRef = yield* Ref.make(HashSet.empty<string>());

  const loadCacheKeys = Effect.fn("CacheManager.loadCacheKeys")(function* () {
    const cached = yield* cache.get(CACHE_KEYS_KEY);
    if (Option.isNone(cached)) return HashSet.empty<string>();
    return yield* Schema.decodeUnknownEffect(storageKeysFromJson)(cached.value).pipe(
      Effect.map(HashSet.fromIterable),
      Effect.orElseSucceed(() => HashSet.empty<string>()),
    );
  });

  const persistCacheKeys = Effect.fn("CacheManager.persistCacheKeys")(function* () {
    const cacheKeys = yield* Ref.get(cacheKeysRef);
    yield* cache.set(CACHE_KEYS_KEY, Schema.encodeSync(storageKeysFromJson)(Array.from(cacheKeys)));
  });

  const storeCacheKey = Effect.fn("CacheManager.storeCacheKey")(function* (key: string) {
    const loadedKeys = yield* loadCacheKeys();
    yield* Ref.update(cacheKeysRef, (keys) => HashSet.add(HashSet.union(keys, loadedKeys), key));
    yield* persistCacheKeys();
  });

  const deleteValue = Effect.fn("CacheManager.delete")(function* (key: string) {
    yield* cache.delete(key);
    yield* Ref.update(cacheKeysRef, (keys) => HashSet.remove(keys, key));
    yield* persistCacheKeys();
  });

  const get = <T>(key: string) =>
    Effect.gen(function* get() {
      const cachedValue = yield* cache.get(key);
      if (Option.isNone(cachedValue)) return Option.none<CacheHit<T>>();

      const cacheHit = yield* Schema.decodeUnknownEffect(cacheEnvelopeFromJson<T>())(
        cachedValue.value,
      ).pipe(Effect.orDie);
      const now = yield* Clock.currentTimeMillis;
      const isExpired = Option.exists(cacheHit.expiresAt, (deadline) => deadline < now);
      const isStale = Option.exists(cacheHit.staleAt, (deadline) => deadline < now);

      if (isExpired) {
        yield* deleteValue(key);
        return Option.none<CacheHit<T>>();
      }

      return Option.some({ ...cacheHit, isExpired, isStale });
    });

  const setValue = <T>(key: string, value: T, options?: { ttl?: number; staleTime?: number }) =>
    Effect.gen(function* setValue() {
      const now = yield* Clock.currentTimeMillis;
      const envelope: CacheEnvelope<T> = {
        createdAt: now,
        expiresAt: deadlineFrom(now, Option.fromNullishOr(options?.ttl)),
        staleAt: deadlineFrom(now, Option.fromNullishOr(options?.staleTime)),
        value,
      };
      yield* cache.set(key, Schema.encodeSync(cacheEnvelopeFromJson<T>())(envelope));
      yield* storeCacheKey(key);
    });

  const getCacheKeys = Effect.fn("CacheManager.getCacheKeys")(function* () {
    const loadedKeys = yield* loadCacheKeys();
    const cacheKeys = yield* Ref.updateAndGet(cacheKeysRef, (keys) =>
      HashSet.union(keys, loadedKeys),
    );
    return Array.from(cacheKeys);
  });

  const clear = Effect.fn("CacheManager.clear")(function* () {
    const cacheKeys = yield* getCacheKeys();
    yield* Effect.forEach(cacheKeys, (key) => cache.delete(key), { concurrency: 1 });
    yield* cache.delete(CACHE_KEYS_KEY);
    yield* Ref.set(cacheKeysRef, HashSet.empty());
  });

  return { clear, delete: deleteValue, get, getCacheKeys, set: setValue } as const;
});

export class CacheManager extends Context.Service<
  CacheManager,
  Effect.Success<ReturnType<typeof make>>
>()("rn-voidhash/CacheManager") {
  static Default = Layer.effect(CacheManager, make());
}
