// import { describe, expect, test } from "vitest";
// import { Effect,  Exit, pipe } from "effect";
// import { AuthSession } from "./auth.service";
// import { createMockEnvironment } from "../testing/__mocks__/environment.mock";
// import { Environment } from "./environment.service";
// import { Environment as EnvironmentEnum } from "@voidhash/lib/constants";
// import { ApiKeyService, ApiKeyNotFoundError } from "./api-key.service";
// import { IntegrationHarness } from "../testing/integration-harness";
// import { createIntegrationTestRunner } from "../effect/runtimes/integration-test";
// import { generateId } from "@/lib/id/generate";

// describe.sequential("ApiKeyService", () => {
// 	test("should create a secret key successfully", async (t) => {
// 		const h = await IntegrationHarness.init(t);

// 		const integrationTestRunner = createIntegrationTestRunner("hono");
// 		const input = {
// 			projectId: h.resources.project.id,
// 			name: "Test API Key",
// 		};
// 		const result = await integrationTestRunner(Effect.gen((function* () {
// 			return yield* pipe(
// 				Effect.gen(function* () {
// 					const apiKeyService = yield* ApiKeyService;
// 					const secretKey = yield* apiKeyService.createSecretKey(input);
// 					return secretKey;
// 				}),
// 				Effect.provide(ApiKeyService.DefaultWithoutDependencies),
// 				Effect.provideService(AuthSession, h.createAuthSession({ type: "user" })),
// 				Effect.provideService(
// 					Environment,
// 					createMockEnvironment(EnvironmentEnum.Production)
// 				)
// 			);
// 		})));

// 		expect(Exit.isSuccess(result)).toBe(true);
// 		const value = Exit.getOrElse(result, (e) => {
// 			throw e;
// 		});
// 		expect(value).toMatchObject({
// 			projectId: h.resources.project.id,
// 			name: "Test API Key",
// 		});
// 		expect(value.rawKey).not.toBe(value.key)
// 		expect(value.end).toBe(value.rawKey.slice(-4))
// 	});

// 	test("should get API keys for a project", async (t) => {
// 		const h = await IntegrationHarness.init(t);

// 		const integrationTestRunner = createIntegrationTestRunner("hono");
// 		const result = await integrationTestRunner(Effect.gen((function* () {
// 			return yield* pipe(
// 				Effect.gen(function* () {
// 					const apiKeyService = yield* ApiKeyService;
// 					const apiKeys = yield* apiKeyService.getApiKeys(h.resources.project.id);
// 					return apiKeys;
// 				}),
// 				Effect.provide(ApiKeyService.DefaultWithoutDependencies),
// 				Effect.provideService(AuthSession, h.createAuthSession({ type: "user" })),
// 				Effect.provideService(
// 					Environment,
// 					createMockEnvironment(EnvironmentEnum.Production)
// 				)
// 			);
// 		})));

// 		expect(Exit.isSuccess(result)).toBe(true);
// 		const value = Exit.getOrElse(result, (e) => {
// 			throw e;
// 		});

// 		// Should return the existing secret key from the harness
// 		expect(value).toHaveLength(1);
// 		expect(value[0]).toMatchObject({
// 			projectId: h.resources.project.id,
// 			name: "Test Secret Key",
// 			environment: EnvironmentEnum.Production,
// 		});
// 	});

// 	test("should get API key by ID", async (t) => {
// 		const h = await IntegrationHarness.init(t);

// 		const integrationTestRunner = createIntegrationTestRunner("hono");
// 		const result = await integrationTestRunner(Effect.gen((function* () {
// 			return yield* pipe(
// 				Effect.gen(function* () {
// 					const apiKeyService = yield* ApiKeyService;
// 					const apiKey = yield* apiKeyService.getApiKeyById(h.resources.secretKey.id);
// 					return apiKey;
// 				}),
// 				Effect.provide(ApiKeyService.DefaultWithoutDependencies),
// 				Effect.provideService(AuthSession, h.createAuthSession({ type: "user" })),
// 				Effect.provideService(
// 					Environment,
// 					createMockEnvironment(EnvironmentEnum.Production)
// 				)
// 			);
// 		})));

// 		expect(Exit.isSuccess(result)).toBe(true);
// 		const value = Exit.getOrElse(result, (e) => {
// 			throw e;
// 		});

// 		expect(value).toMatchObject({
// 			id: h.resources.secretKey.id,
// 			projectId: h.resources.project.id,
// 			name: "Test Secret Key",
// 			environment: EnvironmentEnum.Production,
// 		});
// 	});

// 	test("should delete a secret key successfully", async (t) => {
// 		const h = await IntegrationHarness.init(t);

// 		const integrationTestRunner = createIntegrationTestRunner("hono");
// 		const result = await integrationTestRunner(Effect.gen((function* () {
// 			return yield* pipe(
// 				Effect.gen(function* () {
// 					const apiKeyService = yield* ApiKeyService;
// 					yield* apiKeyService.deleteSecretKey({ secretKeyId: h.resources.secretKey.id });
// 					return "deleted";
// 				}),
// 				Effect.provide(ApiKeyService.DefaultWithoutDependencies),
// 				Effect.provideService(AuthSession, h.createAuthSession({ type: "user" })),
// 				Effect.provideService(
// 					Environment,
// 					createMockEnvironment(EnvironmentEnum.Production)
// 				)
// 			);
// 		})));

// 		expect(Exit.isSuccess(result)).toBe(true);
// 		const value = Exit.getOrElse(result, (e) => {
// 			throw e;
// 		});

// 		expect(value).toBe("deleted");
// 	});

// 	test("should rotate a secret key successfully", async (t) => {
// 		const h = await IntegrationHarness.init(t);

// 		const integrationTestRunner = createIntegrationTestRunner("hono");
// 		const result = await integrationTestRunner(Effect.gen((function* () {
// 			return yield* pipe(
// 				Effect.gen(function* () {
// 					const apiKeyService = yield* ApiKeyService;
// 					const rotatedKey = yield* apiKeyService.rotateSecretKey({ secretKeyId: h.resources.secretKey.id });
// 					return rotatedKey;
// 				}),
// 				Effect.provide(ApiKeyService.DefaultWithoutDependencies),
// 				Effect.provideService(AuthSession, h.createAuthSession({ type: "user" })),
// 				Effect.provideService(
// 					Environment,
// 					createMockEnvironment(EnvironmentEnum.Production)
// 				)
// 			);
// 		})));

// 		expect(Exit.isSuccess(result)).toBe(true);
// 		const value = Exit.getOrElse(result, (e) => {
// 			throw e;
// 		});

// 		expect(value).toMatchObject({
// 			id: h.resources.secretKey.id,
// 			projectId: h.resources.project.id,
// 			name: "Test Secret Key",
// 			environment: EnvironmentEnum.Production,
// 		});
// 		expect(value.rawKey).not.toBe(h.resources.secretKey.unhashedKey);
// 		expect(value.end).toBe(value.rawKey.slice(-4));
// 	});

// 	test("should fail to get API key by non-existent ID", async (t) => {
// 		const h = await IntegrationHarness.init(t);

// 		const integrationTestRunner = createIntegrationTestRunner("hono");
// 		const nonExistentId = generateId("apiSecretKey");
// 		const result = await integrationTestRunner(Effect.gen((function* () {
// 			return yield* pipe(
// 				Effect.gen(function* () {
// 					const apiKeyService = yield* ApiKeyService;
// 					const apiKey = yield* apiKeyService.getApiKeyById(nonExistentId);
// 					return apiKey;
// 				}),
// 				Effect.provide(ApiKeyService.DefaultWithoutDependencies),
// 				Effect.provideService(AuthSession, h.createAuthSession({ type: "user" })),
// 				Effect.provideService(
// 					Environment,
// 					createMockEnvironment(EnvironmentEnum.Production)
// 				)
// 			);
// 		})));

// 		expect(Exit.isFailure(result)).toBe(true);
// 		const error = Exit.getOrElse(result, (e) => e);
// 		expect(error).toBeInstanceOf(Error);
// 		if (error instanceof Error) {
// 			expect(error.message).toContain("API key not found");
// 		}
// 	});

// 	test("should fail to delete non-existent secret key", async (t) => {
// 		const h = await IntegrationHarness.init(t);

// 		const integrationTestRunner = createIntegrationTestRunner("hono");
// 		const nonExistentId = generateId("apiSecretKey");
// 		const result = await integrationTestRunner(Effect.gen((function* () {
// 			return yield* pipe(
// 				Effect.gen(function* () {
// 					const apiKeyService = yield* ApiKeyService;
// 					yield* apiKeyService.deleteSecretKey({ secretKeyId: nonExistentId });
// 					return "deleted";
// 				}),
// 				Effect.provide(ApiKeyService.DefaultWithoutDependencies),
// 				Effect.provideService(AuthSession, h.createAuthSession({ type: "user" })),
// 				Effect.provideService(
// 					Environment,
// 					createMockEnvironment(EnvironmentEnum.Production)
// 				)
// 			);
// 		})));

// 		expect(Exit.isFailure(result)).toBe(true);
// 		const error = Exit.getOrElse(result, (e) => e);
// 		expect(error).toBeInstanceOf(ApiKeyNotFoundError);
// 		if (error instanceof ApiKeyNotFoundError) {
// 			expect(error.message).toContain("Secret key not found");
// 		}
// 	});

// 	test("should fail to rotate non-existent secret key", async (t) => {
// 		const h = await IntegrationHarness.init(t);

// 		const integrationTestRunner = createIntegrationTestRunner("hono");
// 		const nonExistentId = generateId("apiSecretKey");
// 		const result = await integrationTestRunner(Effect.gen((function* () {
// 			return yield* pipe(
// 				Effect.gen(function* () {
// 					const apiKeyService = yield* ApiKeyService;
// 					const rotatedKey = yield* apiKeyService.rotateSecretKey({ secretKeyId: nonExistentId });
// 					return rotatedKey;
// 				}),
// 				Effect.provide(ApiKeyService.DefaultWithoutDependencies),
// 				Effect.provideService(AuthSession, h.createAuthSession({ type: "user" })),
// 				Effect.provideService(
// 					Environment,
// 					createMockEnvironment(EnvironmentEnum.Production)
// 				)
// 			);
// 		})));

// 		expect(Exit.isFailure(result)).toBe(true);
// 		const error = Exit.getOrElse(result, (e) => e);
// 		expect(error).toBeInstanceOf(ApiKeyNotFoundError);
// 		if (error instanceof ApiKeyNotFoundError) {
// 			expect(error.message).toContain("Secret key not found");
// 		}
// 	});

// 	test("should filter API keys by environment", async (t) => {
// 		const h = await IntegrationHarness.init(t);

// 		const integrationTestRunner = createIntegrationTestRunner("hono");
// 		const result = await integrationTestRunner(Effect.gen((function* () {
// 			return yield* pipe(
// 				Effect.gen(function* () {
// 					const apiKeyService = yield* ApiKeyService;
// 					// Test with Testing environment - should return empty array since harness creates Production keys
// 					const apiKeys = yield* apiKeyService.getApiKeys(h.resources.project.id);
// 					return apiKeys;
// 				}),
// 				Effect.provide(ApiKeyService.DefaultWithoutDependencies),
// 				Effect.provideService(AuthSession, h.createAuthSession({ type: "user" })),
// 				Effect.provideService(
// 					Environment,
// 					createMockEnvironment(EnvironmentEnum.Testing)
// 				)
// 			);
// 		})));

// 		expect(Exit.isSuccess(result)).toBe(true);
// 		const value = Exit.getOrElse(result, (e) => {
// 			throw e;
// 		});

// 		// Should return empty array since harness creates Production keys but we're filtering for Testing
// 		expect(value).toHaveLength(0);
// 	});

// 	test("should fail when user lacks project permissions", async (t) => {
// 		const h = await IntegrationHarness.init(t);

// 		// Create a mock auth session without project permissions
// 		const unauthorizedSession = {
// 			...h.createAuthSession({ type: "user" }),
// 			projects: [] // Remove all project permissions
// 		};

// 		const integrationTestRunner = createIntegrationTestRunner("hono");
// 		const result = await integrationTestRunner(Effect.gen((function* () {
// 			return yield* pipe(
// 				Effect.gen(function* () {
// 					const apiKeyService = yield* ApiKeyService;
// 					const apiKeys = yield* apiKeyService.getApiKeys(h.resources.project.id);
// 					return apiKeys;
// 				}),
// 				Effect.provide(ApiKeyService.DefaultWithoutDependencies),
// 				Effect.provideService(AuthSession, unauthorizedSession),
// 				Effect.provideService(
// 					Environment,
// 					createMockEnvironment(EnvironmentEnum.Production)
// 				)
// 			);
// 		})));

// 		expect(Exit.isFailure(result)).toBe(true);
// 		const error = Exit.getOrElse(result, (e) => e);
// 		expect(error).toBeInstanceOf(Error);
// 		if (error instanceof Error) {
// 			expect(error.message).toContain("not authorized to access api keys");
// 		}
// 	});
// });
