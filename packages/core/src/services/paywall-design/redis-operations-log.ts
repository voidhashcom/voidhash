/**
 * Redis Operations Log
 *
 * Provides a safety buffer for real-time persistence. Stores current state
 * snapshots in Redis for fast recovery in case of crashes before MySQL sync.
 */

import { Context, Effect, Layer, Option } from "effect";
import Redis from "ioredis";

import { RedisOperationError } from "./errors";
import { CURRENT_SCHEMA_VERSION } from "./schema-migration";

/** Key prefix for paywall design state in Redis */
const KEY_PREFIX = "mimic:paywall";

/** TTL for Redis entries (24 hours) */
const TTL_SECONDS = 24 * 60 * 60;

/**
 * State snapshot stored in Redis
 */
export interface RedisStateSnapshot {
  readonly state: unknown;
  readonly version: number;
  readonly schemaVersion: number;
  readonly timestamp: number;
}

/**
 * Redis Operations Log service interface
 */
export interface RedisOperationsLog {
  /**
   * Save state snapshot to Redis (called on every save)
   */
  readonly saveState: (
    paywallId: string,
    state: unknown,
    version: number
  ) => Effect.Effect<void, RedisOperationError>;

  /**
   * Load state snapshot from Redis (called on document load)
   */
  readonly loadState: (
    paywallId: string
  ) => Effect.Effect<Option.Option<RedisStateSnapshot>, RedisOperationError>;

  /**
   * Set MySQL sync checkpoint (called after successful MySQL save)
   */
  readonly setCheckpoint: (
    paywallId: string,
    checkpoint: string
  ) => Effect.Effect<void, RedisOperationError>;

  /**
   * Get last MySQL sync checkpoint
   */
  readonly getCheckpoint: (
    paywallId: string
  ) => Effect.Effect<Option.Option<string>, RedisOperationError>;

  /**
   * Delete state from Redis (called on paywall soft delete)
   */
  readonly deleteState: (
    paywallId: string
  ) => Effect.Effect<void, RedisOperationError>;

  /**
   * Close Redis connection
   */
  readonly close: () => Effect.Effect<void, RedisOperationError>;
}

/**
 * Context tag for RedisOperationsLog
 */
export class RedisOperationsLogTag extends Context.Tag(
  "PaywallDesign/RedisOperationsLog"
)<RedisOperationsLogTag, RedisOperationsLog>() {}

/**
 * Build Redis key for state snapshot
 */
const stateKey = (paywallId: string): string =>
  `${KEY_PREFIX}:${paywallId}:state`;

/**
 * Build Redis key for checkpoint
 */
const checkpointKey = (paywallId: string): string =>
  `${KEY_PREFIX}:${paywallId}:checkpoint`;

/**
 * Create RedisOperationsLog implementation
 */
const makeRedisOperationsLog = (redis: Redis): RedisOperationsLog => ({
  saveState: (paywallId: string, state: unknown, version: number) =>
    Effect.tryPromise({
      catch: (error) =>
        new RedisOperationError({
          cause: error,
          operation: "set",
          paywallId,
        }),
      try: async () => {
        const snapshot: RedisStateSnapshot = {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          state,
          timestamp: Date.now(),
          version,
        };
        await redis.setex(
          stateKey(paywallId),
          TTL_SECONDS,
          JSON.stringify(snapshot)
        );
      },
    }),

  loadState: (paywallId: string) =>
    Effect.tryPromise({
      catch: (error) =>
        new RedisOperationError({
          cause: error,
          operation: "get",
          paywallId,
        }),
      try: async () => {
        const data = await redis.get(stateKey(paywallId));
        if (!data) {
          return Option.none();
        }
        return Option.some(JSON.parse(data) as RedisStateSnapshot);
      },
    }),

  setCheckpoint: (paywallId: string, checkpoint: string) =>
    Effect.tryPromise({
      catch: (error) =>
        new RedisOperationError({
          cause: error,
          operation: "set",
          paywallId,
        }),
      try: async () => {
        await redis.setex(checkpointKey(paywallId), TTL_SECONDS, checkpoint);
      },
    }),

  getCheckpoint: (paywallId: string) =>
    Effect.tryPromise({
      catch: (error) =>
        new RedisOperationError({
          cause: error,
          operation: "get",
          paywallId,
        }),
      try: async () => {
        const data = await redis.get(checkpointKey(paywallId));
        return data ? Option.some(data) : Option.none();
      },
    }),

  deleteState: (paywallId: string) =>
    Effect.tryPromise({
      catch: (error) =>
        new RedisOperationError({
          cause: error,
          operation: "delete",
          paywallId,
        }),
      try: async () => {
        await redis.del(stateKey(paywallId), checkpointKey(paywallId));
      },
    }),

  close: () =>
    Effect.tryPromise({
      catch: (error) =>
        new RedisOperationError({
          cause: error,
          operation: "connect",
        }),
      try: async () => {
        await redis.quit();
      },
    }),
});

/**
 * Redis connection configuration
 */
export interface RedisConfig {
  readonly host: string;
  readonly port: number;
}

/**
 * Create a scoped Layer for RedisOperationsLog
 */
export const layer = (
  config: RedisConfig
): Layer.Layer<RedisOperationsLogTag, RedisOperationError> =>
  Layer.scoped(
    RedisOperationsLogTag,
    Effect.acquireRelease(
      Effect.tryPromise({
        catch: (error) =>
          new RedisOperationError({
            cause: error,
            operation: "connect",
          }),
        try: async () => {
          const redis = new Redis({
            host: config.host,
            lazyConnect: true,
            port: config.port,
          });
          await redis.connect();
          return makeRedisOperationsLog(redis);
        },
      }),
      (service) => service.close().pipe(Effect.orDie)
    )
  );

/**
 * Create a Layer using environment variables
 */
export const layerFromEnv =
  (): Layer.Layer<RedisOperationsLogTag, RedisOperationError> =>
    layer({
      host: process.env.REDIS_HOST ?? "localhost",
      port: Number(process.env.REDIS_PORT ?? 6379),
    });

/**
 * Default layer using environment variables
 */
export const Default: Layer.Layer<RedisOperationsLogTag, RedisOperationError> =
  layerFromEnv();
