import * as Arr from "effect/Array";
import * as Cause from "effect/Cause";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import { Diagnostics, DIAGNOSTIC_CODES } from "../diagnostics/diagnostics";
import { SdkConfiguration } from "../sdk-configuration";
import { CacheAdapter, type CacheReadFailed, type CacheWriteFailed } from "./cache-adapter";
import { buildCacheNamespace } from "./namespace";

const CACHE_KEYS_KEY = "cache-keys";

/**
 * Marks the namespace as having absorbed the entries of a pre-namespace SDK
 * release. Written once, after the copy succeeds, so an interrupted migration
 * is retried on the next launch.
 */
const LEGACY_MIGRATION_MARKER_KEY = "legacy-migration";

interface CacheEnvelope<T> {
  readonly value: T;
  readonly expiresAt: Option.Option<number>;
  readonly createdAt: number;
  readonly staleAt: Option.Option<number>;
}

export interface CacheHit<T> extends CacheEnvelope<T> {
  readonly isStale: boolean;
  /**
   * The entry outlived its TTL. It is still returned: TTL drives how urgently
   * the SDK refreshes, not whether the value may be served. Callers that gate
   * high-value content can decide on this flag.
   */
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
  Option.flatMap(offset, (value) => (value === 0 ? Option.none() : Option.some(now + value)));

const make = Effect.fn("makeCacheManager")(function* effect() {
  const cache = yield* CacheAdapter;
  const sdkConfiguration = yield* SdkConfiguration;
  const diagnostics = yield* Diagnostics;
  const cacheKeysRef = yield* Ref.make(HashSet.empty<string>());

  // Every entry is written under `vh:<version>:<hash>:` so the SDK cannot
  // collide with the host app's own storage keys.
  const namespace = buildCacheNamespace(sdkConfiguration.publishableKey, sdkConfiguration.baseUrl);
  const storageKey = (key: string) => `${namespace}${key}`;

  const reportReadFailure = (operation: string) => (failure: CacheReadFailed) =>
    diagnostics.emit({
      code: DIAGNOSTIC_CODES.CACHE_READ_FAILED,
      kind: "cache",
      message: failure.message,
      operation,
      retryable: false,
    });

  const reportWriteFailure = (operation: string) => (failure: CacheWriteFailed) =>
    diagnostics.emit({
      code: DIAGNOSTIC_CODES.CACHE_WRITE_FAILED,
      kind: "cache",
      message: failure.message,
      operation,
      retryable: true,
    });

  /** A store that cannot be written keeps the value in memory; the caller carries on. */
  const absorbWrite = (operation: string) =>
    Effect.catch((failure: CacheWriteFailed) => reportWriteFailure(operation)(failure));

  /**
   * Adopts the entries written by SDK releases that stored unprefixed keys.
   *
   * Without this every existing install would start cold: a new anonymous
   * distinct id (losing the person snapshot and its grants), a re-fired
   * `$app_installed`, a lost analytics session and a lost
   * processed-transaction dedupe window. The old releases tracked everything
   * they wrote in an unprefixed `cache-keys` index, so that index is the
   * complete list of what has to move. Values are copied verbatim — envelope
   * shapes did not change — and a namespaced entry that already exists is
   * never overwritten.
   */
  const migrateLegacyEntries = Effect.fn("CacheManager.migrateLegacyEntries")(function* () {
    const marker = yield* cache.get(storageKey(LEGACY_MIGRATION_MARKER_KEY));
    if (Option.isSome(marker)) return;

    const legacyIndex = yield* cache.get(CACHE_KEYS_KEY);
    const legacyKeys = yield* Option.match(legacyIndex, {
      onNone: () => Effect.succeed(Arr.empty<string>()),
      onSome: (raw) =>
        Schema.decodeUnknownEffect(storageKeysFromJson)(raw).pipe(
          Effect.orElseSucceed(() => Arr.empty<string>()),
        ),
    });

    const migrated = yield* Effect.forEach(
      legacyKeys,
      Effect.fn("CacheManager.migrateLegacyEntry")(function* (key: string) {
        const existing = yield* cache.get(storageKey(key));
        // A namespaced entry always wins: it was written by this release.
        if (Option.isSome(existing)) return Option.some(key);
        const legacyValue = yield* cache.get(key);
        if (Option.isNone(legacyValue)) return Option.none<string>();
        yield* cache.set(storageKey(key), legacyValue.value);
        return Option.some(key);
      }),
      { concurrency: 1 },
    );

    const adopted = Arr.getSomes(migrated);
    if (Arr.isReadonlyArrayNonEmpty(adopted)) {
      yield* Ref.update(cacheKeysRef, (keys) => HashSet.union(keys, HashSet.fromIterable(adopted)));
      yield* persistCacheKeys();
    }

    // Only now that the copies are on disk are the originals removed, so an
    // interruption at any point leaves the legacy entries readable.
    yield* Effect.forEach(legacyKeys, (key) => cache.delete(key), { concurrency: 1 });
    yield* cache.delete(CACHE_KEYS_KEY);
    yield* cache.set(storageKey(LEGACY_MIGRATION_MARKER_KEY), "1");
  });

  const loadCacheKeys = Effect.fn("CacheManager.loadCacheKeys")(function* () {
    const cached = yield* cache
      .get(storageKey(CACHE_KEYS_KEY))
      .pipe(
        Effect.catch((failure: CacheReadFailed) =>
          Effect.as(reportReadFailure("cache.keys")(failure), Option.none<string>()),
        ),
      );
    if (Option.isNone(cached)) return HashSet.empty<string>();
    return yield* Schema.decodeUnknownEffect(storageKeysFromJson)(cached.value).pipe(
      Effect.map(HashSet.fromIterable),
      Effect.orElseSucceed(() => HashSet.empty<string>()),
    );
  });

  const persistCacheKeys = Effect.fn("CacheManager.persistCacheKeys")(function* () {
    const cacheKeys = yield* Ref.get(cacheKeysRef);
    yield* cache
      .set(
        storageKey(CACHE_KEYS_KEY),
        Schema.encodeSync(storageKeysFromJson)(Array.from(cacheKeys)),
      )
      .pipe(absorbWrite("cache.keys"));
  });

  const storeCacheKey = Effect.fn("CacheManager.storeCacheKey")(function* (key: string) {
    const loadedKeys = yield* loadCacheKeys();
    yield* Ref.update(cacheKeysRef, (keys) => HashSet.add(HashSet.union(keys, loadedKeys), key));
    yield* persistCacheKeys();
  });

  /** Deletes the raw entry; answers whether the store confirmed the delete. */
  const tryDeleteRaw = (key: string, operation: string) =>
    cache.delete(storageKey(key)).pipe(
      Effect.as(true),
      Effect.catch((failure: CacheWriteFailed) =>
        Effect.as(reportWriteFailure(operation)(failure), false),
      ),
    );

  /**
   * Deletes an entry. A key whose delete the store rejected stays in the
   * index: dropping it there would orphan the entry on disk where no later
   * `clear` could reach it.
   */
  const deleteValue = Effect.fn("CacheManager.delete")(function* (key: string) {
    const deleted = yield* tryDeleteRaw(key, "cache.delete");
    if (!deleted) return;
    yield* Ref.update(cacheKeysRef, (keys) => HashSet.remove(keys, key));
    yield* persistCacheKeys();
  });

  const getCacheKeys = Effect.fn("CacheManager.getCacheKeys")(function* () {
    const loadedKeys = yield* loadCacheKeys();
    const cacheKeys = yield* Ref.updateAndGet(cacheKeysRef, (keys) =>
      HashSet.union(keys, loadedKeys),
    );
    return Array.from(cacheKeys);
  });

  /**
   * Reads an entry without regard for its TTL, surfacing a store fault as
   * `CacheReadFailed`. Callers that restore durable state at boot use this
   * to tell "nothing persisted" from "could not read", so they never
   * overwrite a store they were unable to load.
   *
   * Expired entries come back with `isExpired: true` rather than being
   * deleted, so an offline device keeps serving its last known state.
   * Deletion happens on overwrite or on an explicit `delete`/`clear`. A
   * corrupt entry is a miss, never a failure: it is dropped and reported.
   */
  const tryGet = <T>(key: string) =>
    Effect.gen(function* tryGet() {
      const cachedValue = yield* cache.get(storageKey(key));
      if (Option.isNone(cachedValue)) return Option.none<CacheHit<T>>();

      const decoded = yield* Effect.result(
        Schema.decodeUnknownEffect(cacheEnvelopeFromJson<T>())(cachedValue.value),
      );
      if (Result.isFailure(decoded)) {
        // A corrupt entry is a miss, never a boot failure: drop it and report.
        yield* diagnostics.emit({
          code: DIAGNOSTIC_CODES.CACHE_READ_FAILED,
          kind: "cache",
          message: `Discarded an unreadable cache entry for "${key}"`,
          operation: "cache.get",
          retryable: false,
        });
        yield* deleteValue(key);
        return Option.none<CacheHit<T>>();
      }

      const cacheHit = decoded.success;
      const now = yield* Clock.currentTimeMillis;
      return Option.some({
        ...cacheHit,
        isExpired: Option.exists(cacheHit.expiresAt, (deadline) => deadline < now),
        isStale:
          Option.exists(cacheHit.expiresAt, (deadline) => deadline < now) ||
          Option.exists(cacheHit.staleAt, (deadline) => deadline < now),
      });
    });

  /** {@link tryGet} with a store fault reported and answered as a miss. */
  const get = <T>(key: string) =>
    tryGet<T>(key).pipe(
      Effect.catch((failure: CacheReadFailed) =>
        Effect.as(reportReadFailure("cache.get")(failure), Option.none<CacheHit<T>>()),
      ),
    );

  const trySetValue = <T>(key: string, value: T, options?: { ttl?: number; staleTime?: number }) =>
    Effect.gen(function* trySetValue() {
      const now = yield* Clock.currentTimeMillis;
      const envelope: CacheEnvelope<T> = {
        createdAt: now,
        expiresAt: deadlineFrom(now, Option.fromNullishOr(options?.ttl)),
        staleAt: deadlineFrom(now, Option.fromNullishOr(options?.staleTime)),
        value,
      };
      const stored = yield* cache
        .set(storageKey(key), Schema.encodeSync(cacheEnvelopeFromJson<T>())(envelope))
        .pipe(
          Effect.as(true),
          Effect.catch((failure: CacheWriteFailed) =>
            Effect.as(reportWriteFailure("cache.set")(failure), false),
          ),
        );
      if (!stored) return false;
      yield* storeCacheKey(key);
      return true;
    });

  const setValue = <T>(key: string, value: T, options?: { ttl?: number; staleTime?: number }) =>
    Effect.asVoid(trySetValue(key, value, options));

  /** Deletes every tracked entry whose key starts with `prefix`. */
  const deleteByPrefix = Effect.fn("CacheManager.deleteByPrefix")(function* (prefix: string) {
    const cacheKeys = yield* getCacheKeys();
    yield* Effect.forEach(
      cacheKeys.filter((key) => key.startsWith(prefix)),
      (key) => deleteValue(key),
      { concurrency: 1 },
    );
  });

  const clear = Effect.fn("CacheManager.clear")(function* () {
    const cacheKeys = yield* getCacheKeys();
    const outcomes = yield* Effect.forEach(
      cacheKeys,
      (key) => Effect.map(tryDeleteRaw(key, "cache.clear"), (deleted) => [key, deleted] as const),
      { concurrency: 1 },
    );
    // Entries the store refused to delete keep their index slot, so the next
    // clear (or a delete by prefix) can still find them.
    const remaining = HashSet.fromIterable(
      outcomes.filter(([, deleted]) => !deleted).map(([key]) => key),
    );
    yield* Ref.set(cacheKeysRef, remaining);
    if (HashSet.size(remaining) > 0) {
      yield* persistCacheKeys();
    } else {
      yield* cache.delete(storageKey(CACHE_KEYS_KEY)).pipe(absorbWrite("cache.clear"));
    }
    // The marker is deliberately not cleared: the legacy entries are gone, so
    // re-running the migration could only resurrect keys this call removed.
    yield* cache.set(storageKey(LEGACY_MIGRATION_MARKER_KEY), "1").pipe(absorbWrite("cache.clear"));
  });

  yield* migrateLegacyEntries().pipe(
    // oxlint-disable-next-line effect/effect-catchall-default -- deliberate blanket recovery: a storage fault during migration must never fail SDK construction; the entries stay readable and the next launch retries.
    Effect.catchCause((cause) =>
      diagnostics.emit({
        code: DIAGNOSTIC_CODES.CACHE_MIGRATION_FAILED,
        kind: "cache",
        message: `Could not migrate entries from a previous SDK release: ${Cause.pretty(cause)}`,
        operation: "cache.migrate",
        retryable: true,
      }),
    ),
  );

  return {
    clear,
    delete: deleteValue,
    deleteByPrefix,
    get,
    getCacheKeys,
    /** Storage-key namespace this manager writes under. Exposed for tests. */
    namespace,
    set: setValue,
    /** Writes an entry while preserving whether the value reached durable storage. */
    trySet: trySetValue,
    tryGet,
  } as const;
});

export class CacheManager extends Context.Service<
  CacheManager,
  Effect.Success<ReturnType<typeof make>>
>()("rn-voidhash/CacheManager") {
  static Default = Layer.effect(CacheManager, make());
}
