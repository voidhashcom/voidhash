/**
 * Redis Mimic Hot Storage
 *
 * Universal Redis-based HotStorage for Write-Ahead Log (WAL) entries.
 * Can be reused across different mimic endpoints.
 */

import {
	HotStorage,
	HotStorageError,
	WalVersionGapError,
	type WalEntry,
} from "@voidhash/mimic-effect";
import { Effect } from "effect";
import { Redis } from "@voidhash/redis";
import { Transaction } from "@voidhash/mimic";

/** TTL for WAL entries (24 hours) */
const TTL_SECONDS = 24 * 60 * 60;

export interface RedisMimicHotStorageConfig {
	readonly keyPrefix?: string;
}

export const RedisMimicHotStorageLive = (config: RedisMimicHotStorageConfig) =>
	HotStorage.make(
		Effect.gen(function* () {
			const redis = yield* Redis.RedisClient;
			const prefix = config.keyPrefix ?? "mimic:wal";

			const encodeEntry = (entry: WalEntry): string =>
				JSON.stringify({
					...entry,
					transaction: Transaction.encode(entry.transaction),
				});

			const decodeEntry = (e: string): WalEntry => {
				const parsed = JSON.parse(e) as WalEntry;
				return {
					...parsed,
					transaction: Transaction.decode(
						parsed.transaction as unknown as Transaction.EncodedTransaction,
					),
				};
			};

			return {
				append: (documentId: string, entry: WalEntry) =>
					Effect.gen(function* () {
						const key = `${prefix}:${documentId}`;
						yield* redis.rpush(key, encodeEntry(entry));
						yield* redis.expire(key, TTL_SECONDS);
					}).pipe(
						Effect.catchAll((cause) =>
							Effect.fail(
								new HotStorageError({
									documentId,
									operation: "append",
									cause,
								}),
							),
						),
					),

				appendWithCheck: (
					documentId: string,
					entry: WalEntry,
					expectedVersion: number,
					baseVersion?: number,
				) =>
					Effect.gen(function* () {
						const key = `${prefix}:${documentId}`;
						const entries = yield* redis.lrange(key, 0, -1);

						// Find the highest version in existing entries
						// Start from baseVersion (or 0 if not provided)
						let lastVersion = baseVersion ?? 0;
						for (const e of entries) {
							const decoded = decodeEntry(e);
							if (decoded.version > lastVersion) {
								lastVersion = decoded.version;
							}
						}

						// Gap check: expected version must be exactly lastVersion + 1
						if (expectedVersion !== lastVersion + 1) {
							yield* Effect.fail(
								new WalVersionGapError({
									documentId,
									expectedVersion,
									actualPreviousVersion:
										lastVersion > 0 ? lastVersion : undefined,
								}),
							);
						}

						// No gap: append the entry
						yield* redis.rpush(key, encodeEntry(entry));
						yield* redis.expire(key, TTL_SECONDS);
					}).pipe(
						Effect.catchAll(
							(
								cause,
							): Effect.Effect<never, HotStorageError | WalVersionGapError> => {
								// Let WalVersionGapError pass through unwrapped
								if (cause instanceof WalVersionGapError) {
									return Effect.fail(cause);
								}
								return Effect.fail(
									new HotStorageError({
										documentId,
										operation: "appendWithCheck",
										cause,
									}),
								);
							},
						),
					),

				getEntries: (documentId: string, sinceVersion: number) =>
					Effect.gen(function* () {
						const key = `${prefix}:${documentId}`;
						const entries = yield* redis.lrange(key, 0, -1);
						return entries
							.map(decodeEntry)
							.filter((e) => e.version > sinceVersion)
							.sort((a, b) => a.version - b.version);
					}).pipe(
						Effect.catchAll((cause) =>
							Effect.fail(
								new HotStorageError({
									documentId,
									operation: "getEntries",
									cause,
								}),
							),
						),
					),

				truncate: (documentId: string, upToVersion: number) =>
					Effect.gen(function* () {
						const key = `${prefix}:${documentId}`;
						const entries = yield* redis.lrange(key, 0, -1);
						const remaining = entries.filter((e) => {
							const decoded = decodeEntry(e);
							return decoded.version > upToVersion;
						});

						yield* redis.del(key);
						if (remaining.length > 0) {
							yield* redis.rpush(key, ...remaining);
							yield* redis.expire(key, TTL_SECONDS);
						}
					}).pipe(
						Effect.catchAll((cause) =>
							Effect.fail(
								new HotStorageError({
									documentId,
									operation: "truncate",
									cause,
								}),
							),
						),
					),
			};
		}),
	);
