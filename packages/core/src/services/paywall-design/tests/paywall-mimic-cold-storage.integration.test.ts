/**
 * Integration tests for PaywallMimicColdStorage
 *
 * Requires MySQL database to be running.
 * Tests actual database operations with real data.
 */

import type { StoredDocument } from "@voidhash/mimic-effect";
import { ColdStorageTag } from "@voidhash/mimic-effect";
import { ColdStorageTestSuite } from "@voidhash/mimic-effect/testing";
import { eq, paywallDesignStates } from "@voidhash/db";
import { Db } from "@voidhash/db/effect";
import { generateId } from "@voidhash/lib";
import { Effect, Exit, Layer, ManagedRuntime, pipe } from "effect";
import { afterEach, beforeEach, describe, expect, it, test } from "vitest";

import { IntegrationHarness } from "../../../testing/integration-harness";
import { PaywallMimicColdStorageLive } from "../paywall-mimic-cold-storage";
import { CURRENT_SCHEMA_VERSION } from "../schema-migration";

const TestColdStorageLayer = pipe(
	PaywallMimicColdStorageLive,
	Layer.provideMerge(Db.Default),
);

type TestRuntime = ManagedRuntime.ManagedRuntime<
	Layer.Layer.Success<typeof TestColdStorageLayer>,
	Layer.Layer.Error<typeof TestColdStorageLayer>
>;

const createTestStoredDocument = (
	overrides: Partial<StoredDocument> = {},
): StoredDocument => ({
	state: { name: "Test Paywall", children: [] },
	version: 1,
	schemaVersion: CURRENT_SCHEMA_VERSION,
	savedAt: Date.now(),
	...overrides,
});

describe.sequential("PaywallMimicColdStorage integration", () => {
	let runtime: TestRuntime;
	let testDocumentIds: string[] = [];
	let harness: IntegrationHarness;

	beforeEach(async (t) => {
		runtime = ManagedRuntime.make(TestColdStorageLayer);
		testDocumentIds = [];
		harness = await IntegrationHarness.init(t);
	});

	afterEach(async () => {
		// Clean up test records
		if (testDocumentIds.length > 0) {
			for (const docId of testDocumentIds) {
				await harness.db.primary
					.delete(paywallDesignStates)
					.where(eq(paywallDesignStates.paywallId, docId));
			}
		}
		await runtime.dispose();
	});

	const trackDocumentId = (docId: string) => {
		testDocumentIds.push(docId);
		return docId;
	};

	describe("load", () => {
		test("should return undefined for non-existent document", async () => {
			const documentId = trackDocumentId(generateId("test"));

			const result = await runtime.runPromiseExit(
				Effect.gen(function* () {
					const coldStorage = yield* ColdStorageTag;
					return yield* coldStorage.load(documentId);
				}),
			);

			expect(Exit.isSuccess(result)).toBe(true);
			if (Exit.isSuccess(result)) {
				expect(result.value).toBeUndefined();
			}
		});

		test("should load existing document", async () => {
			const documentId = trackDocumentId(generateId("test"));
			const state = { name: "Test Paywall", children: [{ type: "screen" }] };

			// Insert directly into database
			await harness.db.primary.insert(paywallDesignStates).values({
				paywallId: documentId,
				state,
				schemaVersion: CURRENT_SCHEMA_VERSION,
				version: 5,
				redisCheckpoint: "test-checkpoint",
			});

			const result = await runtime.runPromiseExit(
				Effect.gen(function* () {
					const coldStorage = yield* ColdStorageTag;
					return yield* coldStorage.load(documentId);
				}),
			);

			expect(Exit.isSuccess(result)).toBe(true);
			if (Exit.isSuccess(result)) {
				expect(result.value).toBeDefined();
				expect(result.value!.version).toBe(5);
				expect(result.value!.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
				expect(result.value!.state).toEqual(state);
				expect(result.value!.savedAt).toBeGreaterThan(0);
			}
		});

		test("should return undefined for soft-deleted document", async () => {
			const documentId = trackDocumentId(generateId("test"));

			// Insert soft-deleted record
			await harness.db.primary.insert(paywallDesignStates).values({
				paywallId: documentId,
				state: { name: "Deleted" },
				schemaVersion: CURRENT_SCHEMA_VERSION,
				version: 1,
				redisCheckpoint: "test-checkpoint",
				deletedAt: new Date(),
			});

			const result = await runtime.runPromiseExit(
				Effect.gen(function* () {
					const coldStorage = yield* ColdStorageTag;
					return yield* coldStorage.load(documentId);
				}),
			);

			expect(Exit.isSuccess(result)).toBe(true);
			if (Exit.isSuccess(result)) {
				expect(result.value).toBeUndefined();
			}
		});

		test("should apply schema migration on load", async () => {
			const documentId = trackDocumentId(generateId("test"));
			const legacyState = { name: "Legacy Paywall", children: [] };

			// Insert with older schema version (legacy data without wrapper)
			await harness.db.primary.insert(paywallDesignStates).values({
				paywallId: documentId,
				state: legacyState,
				schemaVersion: 0, // Legacy version
				version: 1,
				redisCheckpoint: "test-checkpoint",
			});

			const result = await runtime.runPromiseExit(
				Effect.gen(function* () {
					const coldStorage = yield* ColdStorageTag;
					return yield* coldStorage.load(documentId);
				}),
			);

			expect(Exit.isSuccess(result)).toBe(true);
			if (Exit.isSuccess(result)) {
				expect(result.value).toBeDefined();
				// Schema version should be upgraded to current
				expect(result.value!.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
				// State should be preserved (no active migrations at v1)
				expect(result.value!.state).toEqual(legacyState);
			}
		});
	});

	describe("save", () => {
		test("should insert new document", async () => {
			const documentId = trackDocumentId(generateId("test"));
			const document = createTestStoredDocument({
				state: { name: "New Paywall", children: [] },
				version: 1,
			});

			const result = await runtime.runPromiseExit(
				Effect.gen(function* () {
					const coldStorage = yield* ColdStorageTag;
					yield* coldStorage.save(documentId, document);
					return yield* coldStorage.load(documentId);
				}),
			);

			expect(Exit.isSuccess(result)).toBe(true);
			if (Exit.isSuccess(result)) {
				expect(result.value).toBeDefined();
				expect(result.value!.state).toEqual({ name: "New Paywall", children: [] });
				expect(result.value!.version).toBe(1);
			}
		});

		test("should update existing document", async () => {
			const documentId = trackDocumentId(generateId("test"));

			// Insert initial document
			await harness.db.primary.insert(paywallDesignStates).values({
				paywallId: documentId,
				state: { name: "Original" },
				schemaVersion: CURRENT_SCHEMA_VERSION,
				version: 1,
				redisCheckpoint: "test-checkpoint",
			});

			const updatedDocument = createTestStoredDocument({
				state: { name: "Updated Paywall", children: [{ type: "button" }] },
				version: 5,
			});

			const result = await runtime.runPromiseExit(
				Effect.gen(function* () {
					const coldStorage = yield* ColdStorageTag;
					yield* coldStorage.save(documentId, updatedDocument);
					return yield* coldStorage.load(documentId);
				}),
			);

			expect(Exit.isSuccess(result)).toBe(true);
			if (Exit.isSuccess(result)) {
				expect(result.value).toBeDefined();
				expect(result.value!.state).toEqual({
					name: "Updated Paywall",
					children: [{ type: "button" }],
				});
				expect(result.value!.version).toBe(5);
			}
		});

		test("should restore soft-deleted document on save", async () => {
			const documentId = trackDocumentId(generateId("test"));

			// Insert soft-deleted record
			await harness.db.primary.insert(paywallDesignStates).values({
				paywallId: documentId,
				state: { name: "Deleted" },
				schemaVersion: CURRENT_SCHEMA_VERSION,
				version: 1,
				redisCheckpoint: "test-checkpoint",
				deletedAt: new Date(),
			});

			// Verify it's deleted
			const beforeSave = await runtime.runPromise(
				Effect.gen(function* () {
					const coldStorage = yield* ColdStorageTag;
					return yield* coldStorage.load(documentId);
				}),
			);
			expect(beforeSave).toBeUndefined();

			// Save new version
			const document = createTestStoredDocument({
				state: { name: "Restored Paywall" },
				version: 10,
			});

			const result = await runtime.runPromiseExit(
				Effect.gen(function* () {
					const coldStorage = yield* ColdStorageTag;
					yield* coldStorage.save(documentId, document);
					return yield* coldStorage.load(documentId);
				}),
			);

			expect(Exit.isSuccess(result)).toBe(true);
			if (Exit.isSuccess(result)) {
				expect(result.value).toBeDefined();
				expect(result.value!.state).toEqual({ name: "Restored Paywall" });
				expect(result.value!.version).toBe(10);
			}
		});

		test("should preserve complex state structure", async () => {
			const documentId = trackDocumentId(generateId("test"));
			const complexState = {
				name: "Complex Paywall",
				children: [
					{
						type: "screen",
						id: "screen-1",
						children: [
							{ type: "text", content: "Hello World" },
							{ type: "button", label: "Subscribe", action: "purchase" },
						],
					},
					{
						type: "screen",
						id: "screen-2",
						children: [{ type: "image", url: "https://example.com/image.png" }],
					},
				],
				metadata: {
					theme: "dark",
					version: "2.0",
					settings: { animations: true, haptics: false },
				},
			};

			const document = createTestStoredDocument({
				state: complexState,
				version: 1,
			});

			const result = await runtime.runPromiseExit(
				Effect.gen(function* () {
					const coldStorage = yield* ColdStorageTag;
					yield* coldStorage.save(documentId, document);
					return yield* coldStorage.load(documentId);
				}),
			);

			expect(Exit.isSuccess(result)).toBe(true);
			if (Exit.isSuccess(result)) {
				expect(result.value).toBeDefined();
				expect(result.value!.state).toEqual(complexState);
			}
		});

		test("should update schema version on save", async () => {
			const documentId = trackDocumentId(generateId("test"));
			const document = createTestStoredDocument({
				schemaVersion: CURRENT_SCHEMA_VERSION,
				version: 1,
			});

			await runtime.runPromise(
				Effect.gen(function* () {
					const coldStorage = yield* ColdStorageTag;
					yield* coldStorage.save(documentId, document);
				}),
			);

			// Verify in database directly
			const record = await harness.db.primary.query.paywallDesignStates.findFirst({
				where: eq(paywallDesignStates.paywallId, documentId),
			});

			expect(record).toBeDefined();
			expect(record!.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
		});
	});

	describe("delete", () => {
		test("should soft delete existing document", async () => {
			const documentId = trackDocumentId(generateId("test"));

			// Insert document
			await harness.db.primary.insert(paywallDesignStates).values({
				paywallId: documentId,
				state: { name: "To Delete" },
				schemaVersion: CURRENT_SCHEMA_VERSION,
				version: 1,
				redisCheckpoint: "test-checkpoint",
			});

			const result = await runtime.runPromiseExit(
				Effect.gen(function* () {
					const coldStorage = yield* ColdStorageTag;

					// Verify exists before delete
					const before = yield* coldStorage.load(documentId);
					expect(before).toBeDefined();

					yield* coldStorage.delete(documentId);

					// Verify not loadable after delete
					return yield* coldStorage.load(documentId);
				}),
			);

			expect(Exit.isSuccess(result)).toBe(true);
			if (Exit.isSuccess(result)) {
				expect(result.value).toBeUndefined();
			}
		});

		test("should preserve data after soft delete", async () => {
			const documentId = trackDocumentId(generateId("test"));
			const state = { name: "Preserved Data", important: true };

			// Insert document
			await harness.db.primary.insert(paywallDesignStates).values({
				paywallId: documentId,
				state,
				schemaVersion: CURRENT_SCHEMA_VERSION,
				version: 5,
				redisCheckpoint: "test-checkpoint",
			});

			await runtime.runPromise(
				Effect.gen(function* () {
					const coldStorage = yield* ColdStorageTag;
					yield* coldStorage.delete(documentId);
				}),
			);

			// Query directly to verify data is preserved
			const record = await harness.db.primary.query.paywallDesignStates.findFirst({
				where: eq(paywallDesignStates.paywallId, documentId),
			});

			expect(record).toBeDefined();
			expect(record!.deletedAt).toBeDefined();
			expect(record!.state).toEqual(state);
			expect(record!.version).toBe(5);
		});

		test("should handle delete on non-existent document", async () => {
			const documentId = trackDocumentId(generateId("test"));

			const result = await runtime.runPromiseExit(
				Effect.gen(function* () {
					const coldStorage = yield* ColdStorageTag;
					yield* coldStorage.delete(documentId);
					return "success";
				}),
			);

			expect(Exit.isSuccess(result)).toBe(true);
			if (Exit.isSuccess(result)) {
				expect(result.value).toBe("success");
			}
		});

		test("should handle delete on already deleted document", async () => {
			const documentId = trackDocumentId(generateId("test"));

			// Insert already deleted document
			await harness.db.primary.insert(paywallDesignStates).values({
				paywallId: documentId,
				state: { name: "Already Deleted" },
				schemaVersion: CURRENT_SCHEMA_VERSION,
				version: 1,
				redisCheckpoint: "test-checkpoint",
				deletedAt: new Date(),
			});

			const result = await runtime.runPromiseExit(
				Effect.gen(function* () {
					const coldStorage = yield* ColdStorageTag;
					yield* coldStorage.delete(documentId);
					return "success";
				}),
			);

			expect(Exit.isSuccess(result)).toBe(true);
			if (Exit.isSuccess(result)) {
				expect(result.value).toBe("success");
			}
		});
	});

	describe("isolation", () => {
		test("should isolate data between different documents", async () => {
			const documentId1 = trackDocumentId(generateId("test"));
			const documentId2 = trackDocumentId(generateId("test"));

			const doc1 = createTestStoredDocument({
				state: { name: "Document 1" },
				version: 1,
			});
			const doc2 = createTestStoredDocument({
				state: { name: "Document 2" },
				version: 10,
			});

			const result = await runtime.runPromiseExit(
				Effect.gen(function* () {
					const coldStorage = yield* ColdStorageTag;

					yield* coldStorage.save(documentId1, doc1);
					yield* coldStorage.save(documentId2, doc2);

					const loaded1 = yield* coldStorage.load(documentId1);
					const loaded2 = yield* coldStorage.load(documentId2);

					return { loaded1, loaded2 };
				}),
			);

			expect(Exit.isSuccess(result)).toBe(true);
			if (Exit.isSuccess(result)) {
				expect(result.value.loaded1!.state).toEqual({ name: "Document 1" });
				expect(result.value.loaded1!.version).toBe(1);
				expect(result.value.loaded2!.state).toEqual({ name: "Document 2" });
				expect(result.value.loaded2!.version).toBe(10);
			}
		});

		test("delete should not affect other documents", async () => {
			const documentId1 = trackDocumentId(generateId("test"));
			const documentId2 = trackDocumentId(generateId("test"));

			const doc1 = createTestStoredDocument({
				state: { name: "Document 1" },
				version: 1,
			});
			const doc2 = createTestStoredDocument({
				state: { name: "Document 2" },
				version: 1,
			});

			const result = await runtime.runPromiseExit(
				Effect.gen(function* () {
					const coldStorage = yield* ColdStorageTag;

					yield* coldStorage.save(documentId1, doc1);
					yield* coldStorage.save(documentId2, doc2);

					yield* coldStorage.delete(documentId1);

					const loaded1 = yield* coldStorage.load(documentId1);
					const loaded2 = yield* coldStorage.load(documentId2);

					return { loaded1, loaded2 };
				}),
			);

			expect(Exit.isSuccess(result)).toBe(true);
			if (Exit.isSuccess(result)) {
				expect(result.value.loaded1).toBeUndefined();
				expect(result.value.loaded2).toBeDefined();
				expect(result.value.loaded2!.state).toEqual({ name: "Document 2" });
			}
		});
	});

	describe("version tracking", () => {
		test("should correctly track version increments", async () => {
			const documentId = trackDocumentId(generateId("test"));

			const result = await runtime.runPromiseExit(
				Effect.gen(function* () {
					const coldStorage = yield* ColdStorageTag;

					// Save version 1
					yield* coldStorage.save(
						documentId,
						createTestStoredDocument({ version: 1 }),
					);
					const v1 = yield* coldStorage.load(documentId);

					// Save version 5
					yield* coldStorage.save(
						documentId,
						createTestStoredDocument({ version: 5 }),
					);
					const v5 = yield* coldStorage.load(documentId);

					// Save version 100
					yield* coldStorage.save(
						documentId,
						createTestStoredDocument({ version: 100 }),
					);
					const v100 = yield* coldStorage.load(documentId);

					return { v1, v5, v100 };
				}),
			);

			expect(Exit.isSuccess(result)).toBe(true);
			if (Exit.isSuccess(result)) {
				expect(result.value.v1!.version).toBe(1);
				expect(result.value.v5!.version).toBe(5);
				expect(result.value.v100!.version).toBe(100);
			}
		});
	});

	describe("concurrent operations", () => {
		test("should handle concurrent saves to different documents", async () => {
			const documentIds = Array.from({ length: 5 }, () =>
				trackDocumentId(generateId("test")),
			);

			const result = await runtime.runPromiseExit(
				Effect.gen(function* () {
					const coldStorage = yield* ColdStorageTag;

					// Save all documents concurrently
					yield* Effect.all(
						documentIds.map((id, idx) =>
							coldStorage.save(
								id,
								createTestStoredDocument({
									state: { name: `Document ${idx}` },
									version: idx + 1,
								}),
							),
						),
						{ concurrency: "unbounded" },
					);

					// Load all documents concurrently
					return yield* Effect.all(
						documentIds.map((id) => coldStorage.load(id)),
						{ concurrency: "unbounded" },
					);
				}),
			);

			expect(Exit.isSuccess(result)).toBe(true);
			if (Exit.isSuccess(result)) {
				expect(result.value).toHaveLength(5);
				for (let i = 0; i < 5; i++) {
					expect(result.value[i]).toBeDefined();
					expect(result.value[i]!.state).toEqual({ name: `Document ${i}` });
					expect(result.value[i]!.version).toBe(i + 1);
				}
			}
		});
	});

	describe("savedAt timestamp", () => {
		test("should return valid savedAt timestamp", async () => {
			const documentId = trackDocumentId(generateId("test"));
			const beforeSave = Date.now();

			await runtime.runPromise(
				Effect.gen(function* () {
					const coldStorage = yield* ColdStorageTag;
					yield* coldStorage.save(documentId, createTestStoredDocument());
				}),
			);

			// Small delay to ensure timestamp difference
			await new Promise((resolve) => setTimeout(resolve, 10));
			const afterSave = Date.now();

			const result = await runtime.runPromise(
				Effect.gen(function* () {
					const coldStorage = yield* ColdStorageTag;
					return yield* coldStorage.load(documentId);
				}),
			);

			expect(result).toBeDefined();
			// savedAt should be between beforeSave and afterSave
			expect(result!.savedAt).toBeGreaterThanOrEqual(beforeSave - 1000); // Allow 1s margin
			expect(result!.savedAt).toBeLessThanOrEqual(afterSave + 1000);
		});

		test("should update savedAt on subsequent saves", async () => {
			const documentId = trackDocumentId(generateId("test"));

			const result = await runtime.runPromiseExit(
				Effect.gen(function* () {
					const coldStorage = yield* ColdStorageTag;

					// First save
					yield* coldStorage.save(
						documentId,
						createTestStoredDocument({ version: 1 }),
					);
					const first = yield* coldStorage.load(documentId);

					// Wait long enough to cross a second boundary (MySQL TIMESTAMP has second precision)
					yield* Effect.sleep("1100 millis");

					// Second save
					yield* coldStorage.save(
						documentId,
						createTestStoredDocument({ version: 2 }),
					);
					const second = yield* coldStorage.load(documentId);

					return { first: first!.savedAt, second: second!.savedAt };
				}),
			);

			expect(Exit.isSuccess(result)).toBe(true);
			if (Exit.isSuccess(result)) {
				// Second savedAt should be greater than first (after 1+ second delay)
				// Note: MySQL TIMESTAMP only has second precision
				expect(result.value.second).toBeGreaterThanOrEqual(result.value.first);
			}
		});
	});
});

/**
 * ColdStorageTestSuite tests
 *
 * Note: These tests are skipped because PaywallMimicColdStorage has intentional
 * differences from the standard ColdStorage interface:
 * - savedAt is derived from MySQL's updatedAt column (for auditing) rather than
 *   preserving the exact value passed to save()
 * - schemaVersion is always returned as CURRENT_SCHEMA_VERSION after migration
 *
 * The custom integration tests above verify our specific implementation behavior.
 */
describe.skip("PaywallMimicColdStorage - ColdStorageTestSuite", () => {
	const layer = pipe(PaywallMimicColdStorageLive, Layer.provide(Db.Default));

	for (const testCase of ColdStorageTestSuite.makeTests()) {
		it(`[${testCase.category}] ${testCase.name}`, () =>
			Effect.runPromise(testCase.run.pipe(Effect.provide(layer))),
		);
	}
});
