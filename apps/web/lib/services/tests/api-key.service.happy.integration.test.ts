import { describe, expect, test } from "vitest";
import { Effect, Exit, pipe } from "effect";
import { AuthSession } from "../auth.service";
import { createMockEnvironment } from "../../testing/__mocks__/environment.mock";
import { Environment } from "../environment.service";
import { Environment as EnvironmentEnum } from "@voidhash/lib/constants";
import { ApiKeyService } from "../api-key.service";
import { IntegrationHarness } from "../../testing/integration-harness";
import { createIntegrationTestRunner } from "../../effect/runtimes/integration-test";
import { ApiKeyRepository } from "@/lib/repositories/api-key.repository";
import { generateId } from "@/lib/id/generate";
import { hashKey } from "@/lib/core/api-keys/effect/utils";
import { apiKeys, eq } from "@voidhash/db";

describe.sequential("ApiKeyService happy path", () => {
	test("should create a secret key successfully", async (t) => {
		const h = await IntegrationHarness.init(t);

		const integrationTestRunner = createIntegrationTestRunner("hono");
		const input = {
			projectId: h.resources.project.id,
			name: "Test API Key",
		};
		const result = await integrationTestRunner(
			Effect.gen(function* () {
				return yield* pipe(
					Effect.gen(function* () {
						const apiKeyService = yield* ApiKeyService;
						const secretKey = yield* apiKeyService.createSecretKey(input);
						return secretKey;
					}),
					Effect.provide(ApiKeyService.DefaultWithoutDependencies),
					Effect.provideService(
						AuthSession,
						h.createAuthSession({ type: "user" }),
					),
					Effect.provideService(
						Environment,
						createMockEnvironment(EnvironmentEnum.Production),
					),
				);
			}),
		);

		expect(Exit.isSuccess(result)).toBe(true);
		const value = Exit.getOrElse(result, (e) => {
			throw e;
		});
		expect(value).toMatchObject({
			projectId: h.resources.project.id,
			name: "Test API Key",
		});
		expect(value.rawKey).not.toBe(value.key);
		expect(value.end).toBe(value.rawKey.slice(-4));

		t.onTestFinished(async () => {
			if (value?.id) {
				await h.db.primary.delete(apiKeys).where(eq(apiKeys.id, value.id));
			}
		});
	});

	test("should get API keys for a project", async (t) => {
		const h = await IntegrationHarness.init(t);

		const integrationTestRunner = createIntegrationTestRunner("hono");
		const result = await integrationTestRunner(
			Effect.gen(function* () {
				return yield* pipe(
					Effect.gen(function* () {
						const apiKeyService = yield* ApiKeyService;
						const apiKeyRepository = yield* ApiKeyRepository;
						// Test Api Key
						const unhashedTestKey = "test-secret-key";
						const hashedTestKey = yield* hashKey(unhashedTestKey);
						yield* apiKeyRepository.createApiKey({
							id: generateId("test"),
							name: "Test Secret Key",
							key: hashedTestKey,
							createdAt: new Date(),
							updatedAt: new Date(),
							prefix: "test_",
							end: "1234",
							isPublic: false,
							environment: EnvironmentEnum.Testing,
							projectId: h.resources.project.id,
						});

						// Api key, different project
						const unhashedDifferentProjectKey = "test-secret-key-2";
						const hashedDifferentProjectKey = yield* hashKey(
							unhashedDifferentProjectKey,
						);
						yield* apiKeyRepository.createApiKey({
							id: generateId("test"),
							name: "Test Secret Key 2",
							key: hashedDifferentProjectKey,
							createdAt: new Date(),
							updatedAt: new Date(),
							prefix: "test_",
							end: "1234",
							isPublic: false,
							environment: EnvironmentEnum.Production,
							projectId: generateId("test"),
						});

						const apiKeys = yield* apiKeyService.getApiKeys(
							h.resources.project.id,
						);

						return apiKeys;
					}),
					Effect.provide(ApiKeyService.DefaultWithoutDependencies),
					Effect.provideService(
						AuthSession,
						h.createAuthSession({ type: "user" }),
					),
					Effect.provideService(
						Environment,
						createMockEnvironment(EnvironmentEnum.Production),
					),
				);
			}),
		);

		expect(Exit.isSuccess(result)).toBe(true);
		const value = Exit.getOrElse(result, (e) => {
			throw e;
		});

		// Should return the existing secret key from the harness (both secret and publishable)
		expect(value).toHaveLength(2);
		const secretKey = value.find((key) => key.isPublic === false);
		const publishableKey = value.find((key) => key.isPublic === true);
		expect(secretKey).toMatchObject({
			projectId: h.resources.project.id,
			name: "Test Secret Key",
			environment: EnvironmentEnum.Production,
		});
		expect(publishableKey).toMatchObject({
			projectId: h.resources.project.id,
			name: "Test Publishable Key",
			environment: EnvironmentEnum.Production,
		});
	});

	test("should get API key by ID", async (t) => {
		const h = await IntegrationHarness.init(t);

		const integrationTestRunner = createIntegrationTestRunner("hono");
		const result = await integrationTestRunner(
			Effect.gen(function* () {
				return yield* pipe(
					Effect.gen(function* () {
						const apiKeyService = yield* ApiKeyService;
						const apiKey = yield* apiKeyService.getApiKeyById(
							h.resources.secretKey.id,
						);
						return apiKey;
					}),
					Effect.provide(ApiKeyService.DefaultWithoutDependencies),
					Effect.provideService(
						AuthSession,
						h.createAuthSession({ type: "user" }),
					),
					Effect.provideService(
						Environment,
						createMockEnvironment(EnvironmentEnum.Production),
					),
				);
			}),
		);

		expect(Exit.isSuccess(result)).toBe(true);
		const value = Exit.getOrElse(result, (e) => {
			throw e;
		});

		expect(value).toMatchObject({
			id: h.resources.secretKey.id,
			projectId: h.resources.project.id,
			name: "Test Secret Key",
			environment: EnvironmentEnum.Production,
		});
	});

	test("should delete a secret key successfully", async (t) => {
		const h = await IntegrationHarness.init(t);

		const integrationTestRunner = createIntegrationTestRunner("hono");
		const result = await integrationTestRunner(
			Effect.gen(function* () {
				return yield* pipe(
					Effect.gen(function* () {
						const apiKeyService = yield* ApiKeyService;
						yield* apiKeyService.deleteSecretKey({
							secretKeyId: h.resources.secretKey.id,
						});
						return "deleted";
					}),
					Effect.provide(ApiKeyService.DefaultWithoutDependencies),
					Effect.provideService(
						AuthSession,
						h.createAuthSession({ type: "user" }),
					),
					Effect.provideService(
						Environment,
						createMockEnvironment(EnvironmentEnum.Production),
					),
				);
			}),
		);

		expect(Exit.isSuccess(result)).toBe(true);
		const value = Exit.getOrElse(result, (e) => {
			throw e;
		});

		expect(value).toBe("deleted");
	});

	test("should rotate a secret key successfully", async (t) => {
		const h = await IntegrationHarness.init(t);

		const integrationTestRunner = createIntegrationTestRunner("hono");
		const result = await integrationTestRunner(
			Effect.gen(function* () {
				return yield* pipe(
					Effect.gen(function* () {
						const apiKeyService = yield* ApiKeyService;
						const rotatedKey = yield* apiKeyService.rotateSecretKey({
							secretKeyId: h.resources.secretKey.id,
						});
						return rotatedKey;
					}),
					Effect.provide(ApiKeyService.DefaultWithoutDependencies),
					Effect.provideService(
						AuthSession,
						h.createAuthSession({ type: "user" }),
					),
					Effect.provideService(
						Environment,
						createMockEnvironment(EnvironmentEnum.Production),
					),
				);
			}),
		);

		expect(Exit.isSuccess(result)).toBe(true);
		const value = Exit.getOrElse(result, (e) => {
			throw e;
		});

		expect(value).toMatchObject({
			id: h.resources.secretKey.id,
			projectId: h.resources.project.id,
			name: "Test Secret Key",
			environment: EnvironmentEnum.Production,
		});
		expect(value.rawKey).not.toBe(h.resources.secretKey.unhashedKey);
		expect(value.end).toBe(value.rawKey.slice(-4));
	});
});
