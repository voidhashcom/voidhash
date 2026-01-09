// /**
//  * Integration tests for s3-publish-store
//  *
//  * Requires S3-compatible storage (RustFS/MinIO) to be running via docker-compose.
//  * Tests actual S3 operations with real data.
//  */

// import { paywallPublishedVersions, eq } from "@voidhash/db";
// import { Db } from "@voidhash/db/effect";
// import { generateId } from "@voidhash/lib";
// import { Effect, Exit, Option } from "effect";
// import { describe, expect, test } from "vitest";

// import { createIntegrationTestRunner } from "../../../integration-test-runtime";
// import { IntegrationHarness } from "../../../testing/integration-harness";
// import {
// 	layer as s3Layer,
// 	S3ClientLayerTest,
// 	S3PublishStoreTag,
// 	type S3Config,
// } from "../s3-publish-store";

// // Test config - uses local S3 from docker-compose
// const testConfig: S3Config = {
// 	accessKeyId: process.env.S3_ACCESS_KEY ?? "voidhashadmin",
// 	bucket: process.env.S3_PAYWALL_BUCKET ?? "voidhash-paywall-designs",
// 	endpoint: process.env.S3_ENDPOINT ?? "http://localhost:9000",
// 	forcePathStyle: true,
// 	region: process.env.S3_REGION ?? "us-east-1",
// 	secretAccessKey: process.env.S3_SECRET_KEY ?? "voidhashadmin",
// };

// describe.sequential("s3-publish-store integration", () => {
// 	const integrationTestRunner = createIntegrationTestRunner();

// 	test("should publish design to S3 and create version record", async (t) => {
// 		const h = await IntegrationHarness.init(t);
// 		const paywallId = generateId("test");
// 		const projectId = h.resources.project.id;
// 		const userId = h.resources.user.id;

// 		const state = { name: "Published Paywall", children: [] };

// 		const result = await integrationTestRunner(
// 			Effect.gen(function* () {
// 				const s3Store = yield* S3PublishStoreTag;

// 				// Publish
// 				const publishResult = yield* s3Store.publish({
// 					paywallId,
// 					projectId,
// 					publishedBy: userId,
// 					state,
// 				});

// 				expect(publishResult.version).toBe(1);
// 				// S3 key includes versionId to prevent race conditions
// 				expect(publishResult.s3Key).toMatch(
// 					new RegExp(`^${projectId}/${paywallId}/v1-[a-zA-Z0-9_]+\\.json$`),
// 				);
// 				expect(publishResult.s3Bucket).toBe(testConfig.bucket);
// 				expect(publishResult.id).toBeTruthy();

// 				return publishResult;
// 			}).pipe(
// 				Effect.provide(s3Layer(testConfig)),
// 				Effect.provide(S3ClientLayerTest),
// 				Effect.provide(Db.Default),
// 			),
// 		);

// 		expect(Exit.isSuccess(result)).toBe(true);

// 		// Cleanup
// 		t.onTestFinished(async () => {
// 			await h.db.primary
// 				.delete(paywallPublishedVersions)
// 				.where(eq(paywallPublishedVersions.paywallId, paywallId));
// 		});
// 	});

// 	test("should increment version on each publish", async (t) => {
// 		const h = await IntegrationHarness.init(t);
// 		const paywallId = generateId("test");
// 		const projectId = h.resources.project.id;
// 		const userId = h.resources.user.id;

// 		const result = await integrationTestRunner(
// 			Effect.gen(function* () {
// 				const s3Store = yield* S3PublishStoreTag;

// 				// Publish v1
// 				const v1 = yield* s3Store.publish({
// 					paywallId,
// 					projectId,
// 					publishedBy: userId,
// 					state: { version: 1 },
// 				});
// 				expect(v1.version).toBe(1);

// 				// Publish v2
// 				const v2 = yield* s3Store.publish({
// 					paywallId,
// 					projectId,
// 					publishedBy: userId,
// 					state: { version: 2 },
// 				});
// 				expect(v2.version).toBe(2);

// 				// Publish v3
// 				const v3 = yield* s3Store.publish({
// 					paywallId,
// 					projectId,
// 					publishedBy: userId,
// 					state: { version: 3 },
// 				});
// 				expect(v3.version).toBe(3);

// 				return { v1, v2, v3 };
// 			}).pipe(
// 				Effect.provide(s3Layer(testConfig)),
// 				Effect.provide(S3ClientLayerTest),
// 				Effect.provide(Db.Default),
// 			),
// 		);

// 		expect(Exit.isSuccess(result)).toBe(true);

// 		t.onTestFinished(async () => {
// 			await h.db.primary
// 				.delete(paywallPublishedVersions)
// 				.where(eq(paywallPublishedVersions.paywallId, paywallId));
// 		});
// 	});

// 	test("should get active version", async (t) => {
// 		const h = await IntegrationHarness.init(t);
// 		const paywallId = generateId("test");
// 		const projectId = h.resources.project.id;
// 		const userId = h.resources.user.id;

// 		const result = await integrationTestRunner(
// 			Effect.gen(function* () {
// 				const s3Store = yield* S3PublishStoreTag;

// 				// No active version initially
// 				const noActive = yield* s3Store.getActiveVersion(paywallId);
// 				expect(Option.isNone(noActive)).toBe(true);

// 				// Publish first version
// 				yield* s3Store.publish({
// 					paywallId,
// 					projectId,
// 					publishedBy: userId,
// 					state: { version: 1 },
// 				});

// 				// Get active version
// 				const active = yield* s3Store.getActiveVersion(paywallId);
// 				expect(Option.isSome(active)).toBe(true);

// 				if (Option.isSome(active)) {
// 					expect(active.value.version).toBe(1);
// 					expect(active.value.isActive).toBe(true);
// 				}

// 				return active;
// 			}).pipe(
// 				Effect.provide(s3Layer(testConfig)),
// 				Effect.provide(S3ClientLayerTest),
// 				Effect.provide(Db.Default),
// 			),
// 		);

// 		expect(Exit.isSuccess(result)).toBe(true);

// 		t.onTestFinished(async () => {
// 			await h.db.primary
// 				.delete(paywallPublishedVersions)
// 				.where(eq(paywallPublishedVersions.paywallId, paywallId));
// 		});
// 	});

// 	test("should deactivate previous versions when publishing new", async (t) => {
// 		const h = await IntegrationHarness.init(t);
// 		const paywallId = generateId("test");
// 		const projectId = h.resources.project.id;
// 		const userId = h.resources.user.id;

// 		const result = await integrationTestRunner(
// 			Effect.gen(function* () {
// 				const s3Store = yield* S3PublishStoreTag;

// 				// Publish v1
// 				yield* s3Store.publish({
// 					paywallId,
// 					projectId,
// 					publishedBy: userId,
// 					state: { version: 1 },
// 				});

// 				// Publish v2
// 				yield* s3Store.publish({
// 					paywallId,
// 					projectId,
// 					publishedBy: userId,
// 					state: { version: 2 },
// 				});

// 				// Get all versions
// 				const versions = yield* s3Store.getVersions(paywallId);

// 				expect(versions).toHaveLength(2);

// 				// Only v2 should be active
// 				const activeVersions = versions.filter((v) => v.isActive);
// 				expect(activeVersions).toHaveLength(1);
// 				expect(activeVersions[0]?.version).toBe(2);

// 				return versions;
// 			}).pipe(
// 				Effect.provide(s3Layer(testConfig)),
// 				Effect.provide(S3ClientLayerTest),
// 				Effect.provide(Db.Default),
// 			),
// 		);

// 		expect(Exit.isSuccess(result)).toBe(true);

// 		t.onTestFinished(async () => {
// 			await h.db.primary
// 				.delete(paywallPublishedVersions)
// 				.where(eq(paywallPublishedVersions.paywallId, paywallId));
// 		});
// 	});

// 	test("should set active version manually", async (t) => {
// 		const h = await IntegrationHarness.init(t);
// 		const paywallId = generateId("test");
// 		const projectId = h.resources.project.id;
// 		const userId = h.resources.user.id;

// 		const result = await integrationTestRunner(
// 			Effect.gen(function* () {
// 				const s3Store = yield* S3PublishStoreTag;

// 				// Publish v1 and v2
// 				yield* s3Store.publish({
// 					paywallId,
// 					projectId,
// 					publishedBy: userId,
// 					state: { version: 1 },
// 				});

// 				yield* s3Store.publish({
// 					paywallId,
// 					projectId,
// 					publishedBy: userId,
// 					state: { version: 2 },
// 				});

// 				// v2 is active by default
// 				let active = yield* s3Store.getActiveVersion(paywallId);
// 				expect(Option.isSome(active) && active.value.version).toBe(2);

// 				// Roll back to v1
// 				yield* s3Store.setActiveVersion(paywallId, 1);

// 				// v1 should now be active
// 				active = yield* s3Store.getActiveVersion(paywallId);
// 				expect(Option.isSome(active) && active.value.version).toBe(1);

// 				return active;
// 			}).pipe(
// 				Effect.provide(s3Layer(testConfig)),
// 				Effect.provide(S3ClientLayerTest),
// 				Effect.provide(Db.Default),
// 			),
// 		);

// 		expect(Exit.isSuccess(result)).toBe(true);

// 		t.onTestFinished(async () => {
// 			await h.db.primary
// 				.delete(paywallPublishedVersions)
// 				.where(eq(paywallPublishedVersions.paywallId, paywallId));
// 		});
// 	});

// 	test("should get all versions in descending order", async (t) => {
// 		const h = await IntegrationHarness.init(t);
// 		const paywallId = generateId("test");
// 		const projectId = h.resources.project.id;
// 		const userId = h.resources.user.id;

// 		const result = await integrationTestRunner(
// 			Effect.gen(function* () {
// 				const s3Store = yield* S3PublishStoreTag;

// 				// Publish multiple versions
// 				for (let i = 1; i <= 5; i++) {
// 					yield* s3Store.publish({
// 						paywallId,
// 						projectId,
// 						publishedBy: userId,
// 						state: { version: i },
// 					});
// 				}

// 				const versions = yield* s3Store.getVersions(paywallId);

// 				expect(versions).toHaveLength(5);
// 				// Should be in descending order
// 				expect(versions.map((v) => v.version)).toEqual([5, 4, 3, 2, 1]);

// 				return versions;
// 			}).pipe(
// 				Effect.provide(s3Layer(testConfig)),
// 				Effect.provide(S3ClientLayerTest),
// 				Effect.provide(Db.Default),
// 			),
// 		);

// 		expect(Exit.isSuccess(result)).toBe(true);

// 		t.onTestFinished(async () => {
// 			await h.db.primary
// 				.delete(paywallPublishedVersions)
// 				.where(eq(paywallPublishedVersions.paywallId, paywallId));
// 		});
// 	});
// });
