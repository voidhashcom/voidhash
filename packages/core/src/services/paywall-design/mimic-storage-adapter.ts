/**
 * Mimic Storage Adapter
 *
 * Implements MimicDataStorage interface for paywall designs.
 * Coordinates Redis (safety buffer), MySQL (canonical storage), and debouncing.
 */

import { MimicDataStorage } from "@voidhash/mimic-effect";
import { Db } from "@voidhash/db/effect";
import { Duration, Effect, Layer, Option, Ref, Schedule } from "effect";

import {
  DebounceManagerTag,
  layer as debounceLayer,
  type FlushFn,
} from "./debounce-manager";
import { RedisOperationError } from "./errors";
import {
  MySqlSnapshotStoreTag,
  layer as mysqlLayer,
} from "./mysql-snapshot-store";
import {
  RedisOperationsLogTag,
  layer as redisLayer,
} from "./redis-operations-log";
import { CURRENT_SCHEMA_VERSION, migrateStateSync } from "./schema-migration";

/**
 * In-memory version cache for optimistic locking
 */
interface VersionCache {
  version: number;
  lastSaved: number;
}

/**
 * Create the MimicDataStorage implementation for paywall designs
 */
const makePaywallDesignStorage = Effect.gen(function* () {
  const redis = yield* RedisOperationsLogTag;
  const mysql = yield* MySqlSnapshotStoreTag;
  const debounce = yield* DebounceManagerTag;

  // In-memory version cache per document
  const versionCache = yield* Ref.make(new Map<string, VersionCache>());

  /**
   * Get version from cache or initialize
   */
  const getVersion = (paywallId: string) =>
    Ref.get(versionCache).pipe(
      Effect.map((cache) => cache.get(paywallId)?.version ?? 0)
    );

  /**
   * Update version in cache
   */
  const setVersion = (paywallId: string, version: number) =>
    Ref.update(versionCache, (cache) => {
      const newCache = new Map(cache);
      newCache.set(paywallId, { lastSaved: Date.now(), version });
      return newCache;
    });

  /**
   * Flush state to MySQL with retries
   */
  const flushToMySql: FlushFn = (
    paywallId: string,
    state: unknown,
    version: number
  ) =>
    Effect.gen(function* () {
      const currentVersion = yield* getVersion(paywallId);
      const checkpoint = `${Date.now()}-${version}`;

      // Save to MySQL with retry
      yield* mysql
        .save({
          expectedVersion: currentVersion,
          paywallId,
          redisCheckpoint: checkpoint,
          schemaVersion: CURRENT_SCHEMA_VERSION,
          state,
        })
        .pipe(
          Effect.retry(
            Schedule.exponential(Duration.millis(100)).pipe(
              Schedule.intersect(Schedule.recurs(5))
            )
          ),
          Effect.tap(() => setVersion(paywallId, currentVersion + 1)),
          Effect.tap(() => redis.setCheckpoint(paywallId, checkpoint)),
          Effect.tapError((error) =>
            Effect.logError(
              `Failed to flush paywall ${paywallId} to MySQL after retries`,
              error
            )
          ),
          // Don't fail the whole operation - data is safe in Redis
          Effect.catchAll(() => Effect.void)
        );
    });

  const storage: MimicDataStorage.MimicDataStorage = {
    delete: (documentId: string) =>
      Effect.gen(function* () {
        // Cancel any pending flush
        yield* debounce.cancel(documentId);

        // Delete from Redis
        yield* redis.deleteState(documentId).pipe(
          Effect.catchAll(() => Effect.void)
        );

        // Soft delete in MySQL
        yield* mysql.softDelete(documentId);

        // Remove from version cache
        yield* Ref.update(versionCache, (cache) => {
          const newCache = new Map(cache);
          newCache.delete(documentId);
          return newCache;
        });
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(
            new MimicDataStorage.StorageDeleteError({
              cause: error,
              documentId,
            })
          )
        )
      ),

    load: (documentId: string) =>
      Effect.gen(function* () {
        // 1. Try Redis first (fast path for recent state)
        const redisResult = yield* redis.loadState(documentId).pipe(
          Effect.catchAll(() => Effect.succeed(Option.none()))
        );

        if (Option.isSome(redisResult)) {
          const snapshot = redisResult.value;
          yield* setVersion(documentId, snapshot.version);
          return snapshot.state;
        }

        // 2. Fall back to MySQL
        const mysqlResult = yield* mysql.load(documentId).pipe(
          Effect.catchAll(() => Effect.succeed(Option.none()))
        );

        if (Option.isSome(mysqlResult)) {
          const record = mysqlResult.value;
          yield* setVersion(documentId, record.version);
          return record.state;
        }

        // 3. No state found - return undefined (triggers initial function)
        return undefined;
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(
            new MimicDataStorage.StorageLoadError({
              cause: error,
              documentId,
            })
          )
        )
      ),

    // Transform loaded state - apply schema migrations
    onLoad: (state: unknown) =>
      Effect.try({
        catch: (error) => error,
        try: () => migrateStateSync(state),
      }).pipe(
        Effect.catchAll((error) => {
          Effect.logWarning("Schema migration failed, using original state", error);
          return Effect.succeed(state);
        })
      ),

    // Transform state before save - currently a pass-through
    onSave: (state: unknown) => Effect.succeed(state),

    save: (documentId: string, state: unknown) =>
      Effect.gen(function* () {
        const currentVersion = yield* getVersion(documentId);
        const newVersion = currentVersion + 1;

        // 1. Immediately persist to Redis (safety net)
        yield* redis.saveState(documentId, state, newVersion).pipe(
          Effect.tapError((error) =>
            Effect.logWarning(
              `Redis save failed for ${documentId}, will retry via MySQL`,
              error
            )
          ),
          // If Redis fails, still try to continue (MySQL will be the backup)
          Effect.catchAll(() => Effect.void)
        );

        // 2. Update local version cache
        yield* setVersion(documentId, newVersion);

        // 3. Schedule debounced MySQL flush
        yield* debounce.scheduleFlush(documentId, state, newVersion, flushToMySql);
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(
            new MimicDataStorage.StorageSaveError({
              cause: error,
              documentId,
            })
          )
        )
      ),
  };

  return storage;
});

/**
 * Layer for PaywallDesignStorage
 * Provides the MimicDataStorage implementation with all dependencies
 */
export const PaywallDesignStorageLayer: Layer.Layer<
  MimicDataStorage.MimicDataStorageTag,
  RedisOperationError,
  RedisOperationsLogTag | MySqlSnapshotStoreTag | DebounceManagerTag
> = MimicDataStorage.layerEffect(makePaywallDesignStorage);

/**
 * Combined layer that provides all dependencies for paywall design storage
 */
export const makeFullStorageLayer = (
  redisConfig: { host: string; port: number }
): Layer.Layer<MimicDataStorage.MimicDataStorageTag, RedisOperationError, Db> =>
  PaywallDesignStorageLayer.pipe(
    Layer.provide(redisLayer(redisConfig)),
    Layer.provide(mysqlLayer),
    Layer.provide(debounceLayer)
  );

/**
 * Full storage layer using environment variables
 */
export const FullStorageLayerFromEnv: Layer.Layer<
  MimicDataStorage.MimicDataStorageTag,
  RedisOperationError,
  Db
> = makeFullStorageLayer({
  host: process.env.REDIS_HOST ?? "localhost",
  port: Number(process.env.REDIS_PORT ?? 6379),
});
