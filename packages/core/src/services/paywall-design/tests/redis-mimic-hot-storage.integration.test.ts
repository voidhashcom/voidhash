/**
 * Integration tests for RedisMimicHotStorage
 *
 * Requires Redis to be running via docker-compose.
 * Tests actual Redis operations with real data.
 */

import type { WalEntry } from "@voidhash/mimic-effect";
import { HotStorageTag } from "@voidhash/mimic-effect";
import { HotStorageTestSuite } from "@voidhash/mimic-effect/testing";
import { Transaction } from "@voidhash/mimic";
import { Redis } from "@voidhash/redis";
import { Effect, Exit, Layer, ManagedRuntime, pipe } from "effect";
import { afterEach, beforeEach, describe, expect, it, test } from "vitest";

import { RedisMimicHotStorageLive } from "../redis-mimic-hot-storage";

const TEST_KEY_PREFIX = "mimic:wal:test";

const createTestTransaction = (id?: string): Transaction.Transaction => ({
	id: id ?? crypto.randomUUID(),
	ops: [],
	timestamp: Date.now(),
});

const createTestWalEntry = (
	version: number,
	transactionId?: string,
): WalEntry => ({
	transaction: createTestTransaction(transactionId),
	version,
	timestamp: Date.now(),
});

const RedisLive = Redis.layer({
	host: process.env.REDIS_HOST ?? "localhost",
	port: process.env.REDIS_PORT
		? Number.parseInt(process.env.REDIS_PORT, 10)
		: 6379,
});

const TestHotStorageLayer = pipe(
	RedisMimicHotStorageLive({ keyPrefix: TEST_KEY_PREFIX }),
	Layer.provide(RedisLive),
);

const TestLayer = pipe(TestHotStorageLayer, Layer.provideMerge(RedisLive));

type TestRuntime = ManagedRuntime.ManagedRuntime<
	Layer.Layer.Success<typeof TestLayer>,
	Layer.Layer.Error<typeof TestLayer>
>;

describe.sequential("RedisMimicHotStorage integration", () => {
	let runtime: TestRuntime;
	let testDocumentIds: string[] = [];

	beforeEach(async () => {
		runtime = ManagedRuntime.make(TestLayer);
		testDocumentIds = [];
	});

	afterEach(async () => {
		// Clean up test keys
		if (testDocumentIds.length > 0) {
			await runtime.runPromise(
				Effect.gen(function* () {
					const redis = yield* Redis.RedisClient;
					for (const docId of testDocumentIds) {
						yield* redis.del(`${TEST_KEY_PREFIX}:${docId}`);
					}
				}),
			);
		}
		await runtime.dispose();
	});

	const trackDocumentId = (docId: string) => {
		testDocumentIds.push(docId);
		return docId;
	};

	describe("append", () => {
		test("should append a single WAL entry", async () => {
			const documentId = trackDocumentId(`test-append-single-${Date.now()}`);
			const entry = createTestWalEntry(1);

			const result = await runtime.runPromiseExit(
				Effect.gen(function* () {
					const hotStorage = yield* HotStorageTag;
					yield* hotStorage.append(documentId, entry);

					// Verify entry was stored
					const redis = yield* Redis.RedisClient;
					const stored = yield* redis.lrange(
						`${TEST_KEY_PREFIX}:${documentId}`,
						0,
						-1,
					);
					return stored;
				}),
			);

			expect(Exit.isSuccess(result)).toBe(true);
			if (Exit.isSuccess(result)) {
				expect(result.value).toHaveLength(1);
				const parsed = JSON.parse(result.value[0]!);
				expect(parsed.version).toBe(1);
			}
		});

		test("should append multiple WAL entries in order", async () => {
			const documentId = trackDocumentId(`test-append-multiple-${Date.now()}`);

			const result = await runtime.runPromiseExit(
				Effect.gen(function* () {
					const hotStorage = yield* HotStorageTag;

					yield* hotStorage.append(documentId, createTestWalEntry(1));
					yield* hotStorage.append(documentId, createTestWalEntry(2));
					yield* hotStorage.append(documentId, createTestWalEntry(3));

					const redis = yield* Redis.RedisClient;
					const stored = yield* redis.lrange(
						`${TEST_KEY_PREFIX}:${documentId}`,
						0,
						-1,
					);
					return stored;
				}),
			);

			expect(Exit.isSuccess(result)).toBe(true);
			if (Exit.isSuccess(result)) {
				expect(result.value).toHaveLength(3);
				const versions = result.value.map((e) => JSON.parse(e).version);
				expect(versions).toEqual([1, 2, 3]);
			}
		});

		test("should set TTL on the key", async () => {
			const documentId = trackDocumentId(`test-append-ttl-${Date.now()}`);

			const result = await runtime.runPromiseExit(
				Effect.gen(function* () {
					const hotStorage = yield* HotStorageTag;
					yield* hotStorage.append(documentId, createTestWalEntry(1));

					const redis = yield* Redis.RedisClient;
					const ttl = yield* redis.ttl(`${TEST_KEY_PREFIX}:${documentId}`);
					return ttl;
				}),
			);

			expect(Exit.isSuccess(result)).toBe(true);
			if (Exit.isSuccess(result)) {
				// TTL should be set and be close to 24 hours (86400 seconds)
				expect(result.value).toBeGreaterThan(86300);
				expect(result.value).toBeLessThanOrEqual(86400);
			}
		});
	});

	describe("getEntries", () => {
		test("should return empty array for non-existent document", async () => {
			const documentId = trackDocumentId(
				`test-getEntries-nonexistent-${Date.now()}`,
			);

			const result = await runtime.runPromiseExit(
				Effect.gen(function* () {
					const hotStorage = yield* HotStorageTag;
					return yield* hotStorage.getEntries(documentId, 0);
				}),
			);

			expect(Exit.isSuccess(result)).toBe(true);
			if (Exit.isSuccess(result)) {
				expect(result.value).toEqual([]);
			}
		});

		test("should return all entries for sinceVersion 0", async () => {
			const documentId = trackDocumentId(`test-getEntries-all-${Date.now()}`);

			const result = await runtime.runPromiseExit(
				Effect.gen(function* () {
					const hotStorage = yield* HotStorageTag;

					yield* hotStorage.append(documentId, createTestWalEntry(1));
					yield* hotStorage.append(documentId, createTestWalEntry(2));
					yield* hotStorage.append(documentId, createTestWalEntry(3));

					return yield* hotStorage.getEntries(documentId, 0);
				}),
			);

			expect(Exit.isSuccess(result)).toBe(true);
			if (Exit.isSuccess(result)) {
				expect(result.value).toHaveLength(3);
				const versions = result.value.map((e) => e.version);
				expect(versions).toEqual([1, 2, 3]);
			}
		});

		test("should filter entries by sinceVersion", async () => {
			const documentId = trackDocumentId(
				`test-getEntries-filtered-${Date.now()}`,
			);

			const result = await runtime.runPromiseExit(
				Effect.gen(function* () {
					const hotStorage = yield* HotStorageTag;

					yield* hotStorage.append(documentId, createTestWalEntry(1));
					yield* hotStorage.append(documentId, createTestWalEntry(2));
					yield* hotStorage.append(documentId, createTestWalEntry(3));
					yield* hotStorage.append(documentId, createTestWalEntry(4));
					yield* hotStorage.append(documentId, createTestWalEntry(5));

					return yield* hotStorage.getEntries(documentId, 2);
				}),
			);

			expect(Exit.isSuccess(result)).toBe(true);
			if (Exit.isSuccess(result)) {
				expect(result.value).toHaveLength(3);
				const versions = result.value.map((e) => e.version);
				expect(versions).toEqual([3, 4, 5]);
			}
		});

		test("should return entries sorted by version", async () => {
			const documentId = trackDocumentId(
				`test-getEntries-sorted-${Date.now()}`,
			);

			const result = await runtime.runPromiseExit(
				Effect.gen(function* () {
					const hotStorage = yield* HotStorageTag;

					// Insert in non-sequential order
					yield* hotStorage.append(documentId, createTestWalEntry(3));
					yield* hotStorage.append(documentId, createTestWalEntry(1));
					yield* hotStorage.append(documentId, createTestWalEntry(5));
					yield* hotStorage.append(documentId, createTestWalEntry(2));
					yield* hotStorage.append(documentId, createTestWalEntry(4));

					return yield* hotStorage.getEntries(documentId, 0);
				}),
			);

			expect(Exit.isSuccess(result)).toBe(true);
			if (Exit.isSuccess(result)) {
				const versions = result.value.map((e) => e.version);
				expect(versions).toEqual([1, 2, 3, 4, 5]);
			}
		});

		test("should decode transaction correctly", async () => {
			const documentId = trackDocumentId(
				`test-getEntries-decode-${Date.now()}`,
			);
			const transactionId = "test-tx-id-12345";
			const entry = createTestWalEntry(1, transactionId);

			const result = await runtime.runPromiseExit(
				Effect.gen(function* () {
					const hotStorage = yield* HotStorageTag;
					yield* hotStorage.append(documentId, entry);
					return yield* hotStorage.getEntries(documentId, 0);
				}),
			);

			expect(Exit.isSuccess(result)).toBe(true);
			if (Exit.isSuccess(result)) {
				expect(result.value).toHaveLength(1);
				expect(result.value[0]!.transaction.id).toBe(transactionId);
				expect(result.value[0]!.transaction.ops).toEqual([]);
			}
		});

		test("should return empty when sinceVersion is greater than all entries", async () => {
			const documentId = trackDocumentId(
				`test-getEntries-high-version-${Date.now()}`,
			);

			const result = await runtime.runPromiseExit(
				Effect.gen(function* () {
					const hotStorage = yield* HotStorageTag;

					yield* hotStorage.append(documentId, createTestWalEntry(1));
					yield* hotStorage.append(documentId, createTestWalEntry(2));

					return yield* hotStorage.getEntries(documentId, 100);
				}),
			);

			expect(Exit.isSuccess(result)).toBe(true);
			if (Exit.isSuccess(result)) {
				expect(result.value).toEqual([]);
			}
		});
	});

	describe("truncate", () => {
		test("should remove all entries up to specified version", async () => {
			const documentId = trackDocumentId(`test-truncate-basic-${Date.now()}`);

			const result = await runtime.runPromiseExit(
				Effect.gen(function* () {
					const hotStorage = yield* HotStorageTag;

					yield* hotStorage.append(documentId, createTestWalEntry(1));
					yield* hotStorage.append(documentId, createTestWalEntry(2));
					yield* hotStorage.append(documentId, createTestWalEntry(3));
					yield* hotStorage.append(documentId, createTestWalEntry(4));
					yield* hotStorage.append(documentId, createTestWalEntry(5));

					yield* hotStorage.truncate(documentId, 3);

					return yield* hotStorage.getEntries(documentId, 0);
				}),
			);

			expect(Exit.isSuccess(result)).toBe(true);
			if (Exit.isSuccess(result)) {
				expect(result.value).toHaveLength(2);
				const versions = result.value.map((e) => e.version);
				expect(versions).toEqual([4, 5]);
			}
		});

		test("should handle truncate when no entries match", async () => {
			const documentId = trackDocumentId(
				`test-truncate-no-match-${Date.now()}`,
			);

			const result = await runtime.runPromiseExit(
				Effect.gen(function* () {
					const hotStorage = yield* HotStorageTag;

					yield* hotStorage.append(documentId, createTestWalEntry(5));
					yield* hotStorage.append(documentId, createTestWalEntry(6));
					yield* hotStorage.append(documentId, createTestWalEntry(7));

					// Truncate at version lower than all entries
					yield* hotStorage.truncate(documentId, 2);

					return yield* hotStorage.getEntries(documentId, 0);
				}),
			);

			expect(Exit.isSuccess(result)).toBe(true);
			if (Exit.isSuccess(result)) {
				expect(result.value).toHaveLength(3);
				const versions = result.value.map((e) => e.version);
				expect(versions).toEqual([5, 6, 7]);
			}
		});

		test("should delete key when all entries are truncated", async () => {
			const documentId = trackDocumentId(`test-truncate-all-${Date.now()}`);

			const result = await runtime.runPromiseExit(
				Effect.gen(function* () {
					const hotStorage = yield* HotStorageTag;

					yield* hotStorage.append(documentId, createTestWalEntry(1));
					yield* hotStorage.append(documentId, createTestWalEntry(2));

					yield* hotStorage.truncate(documentId, 10);

					const redis = yield* Redis.RedisClient;
					const exists = yield* redis.exists(
						`${TEST_KEY_PREFIX}:${documentId}`,
					);
					return exists;
				}),
			);

			expect(Exit.isSuccess(result)).toBe(true);
			if (Exit.isSuccess(result)) {
				expect(result.value).toBe(0);
			}
		});

		test("should handle truncate on non-existent document", async () => {
			const documentId = trackDocumentId(
				`test-truncate-nonexistent-${Date.now()}`,
			);

			const result = await runtime.runPromiseExit(
				Effect.gen(function* () {
					const hotStorage = yield* HotStorageTag;
					yield* hotStorage.truncate(documentId, 5);
					return yield* hotStorage.getEntries(documentId, 0);
				}),
			);

			expect(Exit.isSuccess(result)).toBe(true);
			if (Exit.isSuccess(result)) {
				expect(result.value).toEqual([]);
			}
		});

		test("should maintain TTL after truncate with remaining entries", async () => {
			const documentId = trackDocumentId(`test-truncate-ttl-${Date.now()}`);

			const result = await runtime.runPromiseExit(
				Effect.gen(function* () {
					const hotStorage = yield* HotStorageTag;

					yield* hotStorage.append(documentId, createTestWalEntry(1));
					yield* hotStorage.append(documentId, createTestWalEntry(2));
					yield* hotStorage.append(documentId, createTestWalEntry(3));

					yield* hotStorage.truncate(documentId, 1);

					const redis = yield* Redis.RedisClient;
					return yield* redis.ttl(`${TEST_KEY_PREFIX}:${documentId}`);
				}),
			);

			expect(Exit.isSuccess(result)).toBe(true);
			if (Exit.isSuccess(result)) {
				// TTL should still be set
				expect(result.value).toBeGreaterThan(86300);
			}
		});
	});

	describe("isolation", () => {
		test("should isolate entries between different documents", async () => {
			const documentId1 = trackDocumentId(`test-isolation-1-${Date.now()}`);
			const documentId2 = trackDocumentId(`test-isolation-2-${Date.now()}`);

			const result = await runtime.runPromiseExit(
				Effect.gen(function* () {
					const hotStorage = yield* HotStorageTag;

					yield* hotStorage.append(documentId1, createTestWalEntry(1));
					yield* hotStorage.append(documentId1, createTestWalEntry(2));
					yield* hotStorage.append(documentId2, createTestWalEntry(10));
					yield* hotStorage.append(documentId2, createTestWalEntry(20));

					const entries1 = yield* hotStorage.getEntries(documentId1, 0);
					const entries2 = yield* hotStorage.getEntries(documentId2, 0);

					return { entries1, entries2 };
				}),
			);

			expect(Exit.isSuccess(result)).toBe(true);
			if (Exit.isSuccess(result)) {
				expect(result.value.entries1).toHaveLength(2);
				expect(result.value.entries1.map((e) => e.version)).toEqual([1, 2]);

				expect(result.value.entries2).toHaveLength(2);
				expect(result.value.entries2.map((e) => e.version)).toEqual([10, 20]);
			}
		});

		test("truncate should not affect other documents", async () => {
			const documentId1 = trackDocumentId(
				`test-truncate-isolation-1-${Date.now()}`,
			);
			const documentId2 = trackDocumentId(
				`test-truncate-isolation-2-${Date.now()}`,
			);

			const result = await runtime.runPromiseExit(
				Effect.gen(function* () {
					const hotStorage = yield* HotStorageTag;

					yield* hotStorage.append(documentId1, createTestWalEntry(1));
					yield* hotStorage.append(documentId1, createTestWalEntry(2));
					yield* hotStorage.append(documentId2, createTestWalEntry(1));
					yield* hotStorage.append(documentId2, createTestWalEntry(2));

					yield* hotStorage.truncate(documentId1, 10);

					const entries1 = yield* hotStorage.getEntries(documentId1, 0);
					const entries2 = yield* hotStorage.getEntries(documentId2, 0);

					return { entries1, entries2 };
				}),
			);

			expect(Exit.isSuccess(result)).toBe(true);
			if (Exit.isSuccess(result)) {
				expect(result.value.entries1).toHaveLength(0);
				expect(result.value.entries2).toHaveLength(2);
			}
		});
	});

	describe("concurrent operations", () => {
		test("should handle concurrent appends correctly", async () => {
			const documentId = trackDocumentId(`test-concurrent-${Date.now()}`);

			const result = await runtime.runPromiseExit(
				Effect.gen(function* () {
					const hotStorage = yield* HotStorageTag;

					// Append 10 entries concurrently
					yield* Effect.all(
						Array.from({ length: 10 }, (_, i) =>
							hotStorage.append(documentId, createTestWalEntry(i + 1)),
						),
						{ concurrency: "unbounded" },
					);

					return yield* hotStorage.getEntries(documentId, 0);
				}),
			);

			expect(Exit.isSuccess(result)).toBe(true);
			if (Exit.isSuccess(result)) {
				expect(result.value).toHaveLength(10);
				// Versions should be sorted correctly regardless of append order
				const versions = result.value.map((e) => e.version);
				expect(versions).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
			}
		});
	});
});

/**
 * HotStorageTestSuite tests
 *
 * Run the standard test suite from @voidhash/mimic-effect/testing
 * to verify RedisMimicHotStorage implements the HotStorage interface correctly.
 */
describe("RedisMimicHotStorage - HotStorageTestSuite", () => {
	const layer = pipe(
		RedisMimicHotStorageLive({ keyPrefix: `mimic:wal:suite:${Date.now()}` }),
		Layer.provide(
			Redis.layer({
				host: process.env.REDIS_HOST ?? "localhost",
				port: process.env.REDIS_PORT
					? Number.parseInt(process.env.REDIS_PORT, 10)
					: 6379,
			}),
		),
	);

	for (const testCase of HotStorageTestSuite.makeTests()) {
		it(`[${testCase.category}] ${testCase.name}`, () =>
			Effect.runPromise(testCase.run.pipe(Effect.provide(layer))));
	}
});
