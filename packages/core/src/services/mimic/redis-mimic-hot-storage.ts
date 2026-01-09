/**
 * Redis Mimic Hot Storage
 *
 * Universal Redis-based HotStorage for Write-Ahead Log (WAL) entries.
 * Can be reused across different mimic endpoints.
 */

import { HotStorage, type WalEntry } from "@voidhash/mimic-effect";
import { Effect, Layer } from "effect";
import { Redis } from "@voidhash/redis";

/** TTL for WAL entries (24 hours) */
const TTL_SECONDS = 24 * 60 * 60;

export interface RedisMimicHotStorageConfig {
	readonly keyPrefix?: string;
}

export const RedisMimicHotStorageLive = (config: RedisMimicHotStorageConfig) =>
	Layer.scoped(
		HotStorage.Tag,
		Effect.gen(function* () {
			const redis = yield* Redis.RedisClient;
			const prefix = config.keyPrefix ?? "mimic:wal";

			return {
				append: Effect.fn("append")(
					function* (documentId: string, entry: WalEntry) {
						const key = `${prefix}:${documentId}`;
						yield* redis.rpush(key, JSON.stringify(entry));
						yield* redis.expire(key, TTL_SECONDS);
					},
					(e) =>
						e.pipe(
							Effect.asVoid,
							Effect.catchAll(() => Effect.void),
						),
				),

				getEntries: Effect.fn("getEntries")(
					function* (documentId: string, sinceVersion: number) {
						const key = `${prefix}:${documentId}`;
						const entries = yield* redis.lrange(key, 0, -1);
						return entries
							.map((e) => JSON.parse(e) as WalEntry)
							.filter((e) => e.version > sinceVersion)
							.sort((a: WalEntry, b: WalEntry) => a.version - b.version);
					},
					(e) =>
						e.pipe(
							Effect.tapError((e) => Effect.logError(e.message)),
							Effect.catchAll(() => Effect.succeed([] as WalEntry[])),
						),
				),

				truncate: Effect.fn("truncate")(
					function* (documentId: string, upToVersion: number) {
						const key = `${prefix}:${documentId}`;
						const entries = yield* redis.lrange(key, 0, -1);
						const remaining = entries.filter((e) => {
							const entry = JSON.parse(e) as WalEntry;
							return entry.version > upToVersion;
						});

						yield* redis.del(key);
						if (remaining.length > 0) {
							yield* redis.rpush(key, ...remaining);
							yield* redis.expire(key, TTL_SECONDS);
						}
					},
					(e) =>
						e.pipe(
							Effect.asVoid,
							Effect.catchAll(() => Effect.void),
						),
				),
			};
		}),
	);
