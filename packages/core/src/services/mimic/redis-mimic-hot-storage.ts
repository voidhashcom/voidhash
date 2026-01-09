/**
 * Redis Mimic Hot Storage
 *
 * Universal Redis-based HotStorage for Write-Ahead Log (WAL) entries.
 * Can be reused across different mimic endpoints.
 */

import { HotStorage, type WalEntry } from "@voidhash/mimic-effect";
import { Effect, Layer } from "effect";
import Redis from "ioredis";

/** TTL for WAL entries (24 hours) */
const TTL_SECONDS = 24 * 60 * 60;

export interface RedisMimicHotStorageConfig {
  readonly host: string;
  readonly port: number;
  readonly keyPrefix?: string;
}

export const RedisMimicHotStorageLive = (config: RedisMimicHotStorageConfig) =>
  Layer.scoped(
    HotStorage.Tag,
    Effect.acquireRelease(
      Effect.tryPromise({
        catch: (error) => error as Error,
        try: async () => {
          const redis = new Redis({
            host: config.host,
            lazyConnect: true,
            port: config.port,
          });
          await redis.connect();
          return redis;
        },
      }),
      (redis) => Effect.promise(() => redis.quit())
    ).pipe(
      Effect.map((redis) => {
        const prefix = config.keyPrefix ?? "mimic:wal";

        return {
          append: (documentId: string, entry: WalEntry) =>
            Effect.tryPromise({
              catch: (error) => error,
              try: async () => {
                const key = `${prefix}:${documentId}`;
                await redis.rpush(key, JSON.stringify(entry));
                await redis.expire(key, TTL_SECONDS);
              },
            }).pipe(
              Effect.asVoid,
              Effect.catchAll(() => Effect.void)
            ),

          getEntries: (documentId: string, sinceVersion: number) =>
            Effect.tryPromise({
              catch: () => [] as WalEntry[],
              try: async () => {
                const key = `${prefix}:${documentId}`;
                const entries = await redis.lrange(key, 0, -1);
                return entries
                  .map((e) => JSON.parse(e) as WalEntry)
                  .filter((e) => e.version > sinceVersion)
                  .sort((a: WalEntry, b: WalEntry) => a.version - b.version);
              },
            }).pipe(Effect.catchAll(() => Effect.succeed([] as WalEntry[]))),

          truncate: (documentId: string, upToVersion: number) =>
            Effect.tryPromise({
              catch: (error) => error,
              try: async () => {
                const key = `${prefix}:${documentId}`;
                const entries = await redis.lrange(key, 0, -1);
                const remaining = entries.filter((e) => {
                  const entry = JSON.parse(e) as WalEntry;
                  return entry.version > upToVersion;
                });

                await redis.del(key);
                if (remaining.length > 0) {
                  await redis.rpush(key, ...remaining);
                  await redis.expire(key, TTL_SECONDS);
                }
              },
            }).pipe(
              Effect.asVoid,
              Effect.catchAll(() => Effect.void)
            ),
        };
      })
    )
  );

/**
 * Layer from environment variables
 */
export const RedisMimicHotStorageFromEnv = RedisMimicHotStorageLive({
  host: process.env.REDIS_HOST ?? "localhost",
  port: Number(process.env.REDIS_PORT ?? 6379),
});
