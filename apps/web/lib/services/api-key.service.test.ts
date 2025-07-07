import { describe, beforeEach, afterEach, vi } from "vitest";
import { it, expect } from "@effect/vitest";
import { Effect, pipe } from "effect";
import {
	createMockApiKeyRepository,
	MockApiKeyRepository,
} from "../testing/__mocks__/repositories/api-key.repository.mock";
import { createMockUserAuthSession } from "../testing/__mocks__/auth.mock";
import { ApiKey } from "@voidhash/db";
import { AuthSession } from "./auth.service";
import { ApiKeyRepository } from "../repositories/api-key.repository";
import { createMockEnvironment } from "../testing/__mocks__/environment.mock";
import { Environment } from "./environment.service";
import { Environment as EnvironmentEnum } from "@voidhash/lib/constants";
import { ApiKeyService } from "./api-key.service";

describe.sequential("ApiKeyService", () => {
	let mockApiKeyRepository: MockApiKeyRepository;
	let mockApiKey: ApiKey;

	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks();

		// Setup default mocks
		mockApiKeyRepository = createMockApiKeyRepository();

		mockApiKey = {
			id: "api_sk_mocked_id_1234567890",
			projectId: "proj_123",
			name: "Test API Key",
			key: "mocked_hashed_key_1234567890abcdef",
			isPublic: false,
			end: "efgh",
			prefix: "vh_sk_test_",
			environment: EnvironmentEnum.Testing,
			createdAt: new Date("2024-01-01T00:00:00Z"),
			updatedAt: new Date("2024-01-01T00:00:00Z"),
		};
	});

	afterEach(() => {
		mockApiKeyRepository.helpers.reset();
	});

	// describe("createSecretKey", () => {
	it.effect("should create a secret key successfully", () =>
		Effect.gen(function* () {
			const input = {
				projectId: "proj_123",
				name: "Test API Key",
			};

			// Setup mocks
			mockApiKeyRepository.helpers.setupCreateApiKey(
				Effect.succeed({ id: "api_sk_mocked_id_1234567890" })
			);
			mockApiKeyRepository.helpers.setupGetApiKeyById(
				Effect.succeed(mockApiKey)
			);

			const result = yield* pipe(
				Effect.gen(function* () {
					const apiKeyService = yield* ApiKeyService;
					const secretKey = yield* apiKeyService.createSecretKey(input);
					return secretKey;
				}),
				Effect.provide(ApiKeyService.DefaultWithoutDependencies),
				Effect.provideService(ApiKeyRepository, mockApiKeyRepository.mock),
				Effect.provideService(AuthSession, createMockUserAuthSession()),
				Effect.provideService(
					Environment,
					createMockEnvironment(EnvironmentEnum.Testing)
				)
			);

			console.log(result);

			expect(result).toMatchObject({
				...mockApiKey,
				rawKey: "vh_sk_test_mocked_raw_key_1234567890abcdef",
			});

			expect(mockApiKeyRepository.mock.createApiKey).toHaveBeenCalledWith({
				id: "apiSecretKey_mocked_id_1234567890",
				projectId: "proj_123",
				name: "Test API Key",
				key: "mocked_hashed_key_1234567890abcdef",
				isPublic: false,
				end: "efgh",
				prefix: "vh_sk_test_",
				environment: EnvironmentEnum.Testing,
			});

			expect(mockApiKeyRepository.mock.getApiKeyById).toHaveBeenCalledWith(
				"apiSecretKey_mocked_id_1234567890"
			);
		})
	);

	// 	it.effect("should fail when API key is not found after creation", Effect.gen(function* () {
	// 		const input = {
	// 			projectId: "proj_123",
	// 			name: "Test API Key",
	// 		};

	// 		// Setup mocks
	// 		mockApiKeyRepository.setupCreateApiKey(Effect.succeed(undefined));
	// 		mockApiKeyRepository.setupGetApiKeyById(Effect.succeed(null));

	// 		const result = yield* pipe(
	// 			ApiKeyService.createSecretKey(input),
	// 			Effect.provideService(ApiKeyRepository.Default, mockApiKeyRepository),
	// 			Effect.provideService(AuthSession.Default, createMockAuthSessionEffect(mockAuthSession)),
	// 			Effect.provideService(Environment.Default, createMockEnvironmentEffect(Environment.Testing)),
	// 			Effect.either
	// 		);

	// 		expect(result).toEqual(Effect.fail(new ApiKeyNotFoundError({
	// 			message: "API key not found",
	// 		})));
	// 	}));

	// 	it.effect("should fail when user lacks permission", Effect.gen(function* () {
	// 		const input = {
	// 			projectId: "proj_123",
	// 			name: "Test API Key",
	// 		};

	// 		// Setup mocks with permission failure
	// 		vi.mocked(checkProjectPermission).mockImplementation(createMockCheckProjectPermission(false));

	// 		const result = yield* pipe(
	// 			ApiKeyService.createSecretKey(input),
	// 			Effect.provideService(ApiKeyRepository.Default, mockApiKeyRepository),
	// 			Effect.provideService(AuthSession.Default, createMockAuthSessionEffect(mockAuthSession)),
	// 			Effect.provideService(Environment.Default, createMockEnvironmentEffect(Environment.Testing)),
	// 			Effect.either
	// 		);

	// 		expect(result).toEqual(Effect.fail(new Error("Permission denied")));
	// 	}));
	// });

	// describe("getApiKeys", () => {
	// 	it.effect("should return filtered API keys for project", Effect.gen(function* () {
	// 		const projectId = "proj_123";
	// 		const mockApiKeys = [
	// 			{ ...mockApiKey, environment: Environment.Testing },
	// 			{ ...mockApiKey, id: "api_sk_2", environment: Environment.Production },
	// 		];

	// 		// Setup mocks
	// 		mockApiKeyRepository.setupGetApiKeys(Effect.succeed(mockApiKeys));

	// 		const result = yield* pipe(
	// 			ApiKeyService.getApiKeys(projectId),
	// 			Effect.provideService(ApiKeyRepository.Default, mockApiKeyRepository),
	// 			Effect.provideService(AuthSession.Default, createMockAuthSessionEffect(mockAuthSession)),
	// 			Effect.provideService(Environment.Default, createMockEnvironmentEffect(Environment.Testing))
	// 		);

	// 		expect(result).toEqual([mockApiKeys[0]]); // Only testing environment keys
	// 		expect(mockApiKeyRepository.getApiKeys).toHaveBeenCalledWith(projectId);
	// 	}));

	// 	it.effect("should fail when user lacks permission", Effect.gen(function* () {
	// 		const projectId = "proj_123";

	// 		// Setup mocks with permission failure
	// 		vi.mocked(checkProjectPermission).mockImplementation(createMockCheckProjectPermission(false));

	// 		const result = yield* pipe(
	// 			ApiKeyService.getApiKeys(projectId),
	// 			Effect.provideService(ApiKeyRepository.Default, mockApiKeyRepository),
	// 			Effect.provideService(AuthSession.Default, createMockAuthSessionEffect(mockAuthSession)),
	// 			Effect.provideService(Environment.Default, createMockEnvironmentEffect(Environment.Testing)),
	// 			Effect.either
	// 		);

	// 		expect(result).toEqual(Effect.fail(new Error("Permission denied")));
	// 	}));
	// });

	// describe("getApiKeyById", () => {
	// 	it.effect("should return API key by ID", Effect.gen(function* () {
	// 		const apiKeyId = "api_sk_mocked_id_1234567890";

	// 		// Setup mocks
	// 		mockApiKeyRepository.setupGetApiKeyById(Effect.succeed(mockApiKey));

	// 		const result = yield* pipe(
	// 			ApiKeyService.getApiKeyById(apiKeyId),
	// 			Effect.provideService(ApiKeyRepository.Default, mockApiKeyRepository),
	// 			Effect.provideService(AuthSession.Default, createMockAuthSessionEffect(mockAuthSession))
	// 		);

	// 		expect(result).toEqual(mockApiKey);
	// 		expect(mockApiKeyRepository.getApiKeyById).toHaveBeenCalledWith(apiKeyId);
	// 	}));

	// 	it.effect("should fail when API key is not found", Effect.gen(function* () {
	// 		const apiKeyId = "non_existent_id";

	// 		// Setup mocks
	// 		mockApiKeyRepository.setupGetApiKeyById(Effect.succeed(null));

	// 		const result = yield* pipe(
	// 			ApiKeyService.getApiKeyById(apiKeyId),
	// 			Effect.provideService(ApiKeyRepository.Default, mockApiKeyRepository),
	// 			Effect.provideService(AuthSession.Default, createMockAuthSessionEffect(mockAuthSession)),
	// 			Effect.either
	// 		);

	// 		expect(result).toEqual(Effect.fail(new NotFoundError({
	// 			message: "API key not found",
	// 		})));
	// 	}));

	// 	it.effect("should fail when user lacks permission", Effect.gen(function* () {
	// 		const apiKeyId = "api_sk_mocked_id_1234567890";

	// 		// Setup mocks
	// 		mockApiKeyRepository.setupGetApiKeyById(Effect.succeed(mockApiKey));
	// 		vi.mocked(checkProjectPermission).mockImplementation(createMockCheckProjectPermission(false));

	// 		const result = yield* pipe(
	// 			ApiKeyService.getApiKeyById(apiKeyId),
	// 			Effect.provideService(ApiKeyRepository.Default, mockApiKeyRepository),
	// 			Effect.provideService(AuthSession.Default, createMockAuthSessionEffect(mockAuthSession)),
	// 			Effect.either
	// 		);

	// 		expect(result).toEqual(Effect.fail(new Error("Permission denied")));
	// 	}));
	// });

	// describe("deleteSecretKey", () => {
	// 	it.effect("should delete secret key successfully", Effect.gen(function* () {
	// 		const secretKeyId = "api_sk_mocked_id_1234567890";

	// 		// Setup mocks
	// 		mockApiKeyRepository.setupGetApiKeyById(Effect.succeed(mockApiKey));
	// 		mockApiKeyRepository.setupDeleteApiKey(Effect.succeed(undefined));

	// 		const result = yield* pipe(
	// 			ApiKeyService.deleteSecretKey({ secretKeyId }),
	// 			Effect.provideService(ApiKeyRepository.Default, mockApiKeyRepository),
	// 			Effect.provideService(AuthSession.Default, createMockAuthSessionEffect(mockAuthSession))
	// 		);

	// 		expect(result).toBeUndefined();
	// 		expect(mockApiKeyRepository.getApiKeyById).toHaveBeenCalledWith(secretKeyId);
	// 		expect(mockApiKeyRepository.deleteApiKey).toHaveBeenCalledWith(secretKeyId);
	// 	}));

	// 	it.effect("should fail when secret key is not found", Effect.gen(function* () {
	// 		const secretKeyId = "non_existent_id";

	// 		// Setup mocks
	// 		mockApiKeyRepository.setupGetApiKeyById(Effect.succeed(null));

	// 		const result = yield* pipe(
	// 			ApiKeyService.deleteSecretKey({ secretKeyId }),
	// 			Effect.provideService(ApiKeyRepository.Default, mockApiKeyRepository),
	// 			Effect.provideService(AuthSession.Default, createMockAuthSessionEffect(mockAuthSession)),
	// 			Effect.either
	// 		);

	// 		expect(result).toEqual(Effect.fail(new ApiKeyNotFoundError({
	// 			message: "Secret key not found",
	// 		})));
	// 	}));

	// 	it.effect("should fail when user lacks permission", Effect.gen(function* () {
	// 		const secretKeyId = "api_sk_mocked_id_1234567890";

	// 		// Setup mocks
	// 		mockApiKeyRepository.setupGetApiKeyById(Effect.succeed(mockApiKey));
	// 		vi.mocked(checkProjectPermission).mockImplementation(createMockCheckProjectPermission(false));

	// 		const result = yield* pipe(
	// 			ApiKeyService.deleteSecretKey({ secretKeyId }),
	// 			Effect.provideService(ApiKeyRepository.Default, mockApiKeyRepository),
	// 			Effect.provideService(AuthSession.Default, createMockAuthSessionEffect(mockAuthSession)),
	// 			Effect.either
	// 		);

	// 		expect(result).toEqual(Effect.fail(new Error("Permission denied")));
	// 	}));
	// });

	// describe("rotateSecretKey", () => {
	// 	it.effect("should rotate secret key successfully", Effect.gen(function* () {
	// 		const secretKeyId = "api_sk_mocked_id_1234567890";

	// 		// Setup mocks
	// 		mockApiKeyRepository.setupGetApiKeyById(Effect.succeed(mockApiKey));
	// 		mockApiKeyRepository.setupUpdateApiKey(Effect.succeed(undefined));

	// 		const result = yield* pipe(
	// 			ApiKeyService.rotateSecretKey({ secretKeyId }),
	// 			Effect.provideService(ApiKeyRepository.Default, mockApiKeyRepository),
	// 			Effect.provideService(AuthSession.Default, createMockAuthSessionEffect(mockAuthSession))
	// 		);

	// 		expect(result).toEqual({
	// 			...mockApiKey,
	// 			key: "mocked_hashed_key_1234567890abcdef",
	// 			rawKey: "vh_sk_test_mocked_raw_key_1234567890abcdef",
	// 			end: "efgh",
	// 			prefix: "vh_sk_test_",
	// 			environment: Environment.Testing,
	// 			updatedAt: expect.any(Date),
	// 			createdAt: expect.any(Date),
	// 		});

	// 		expect(mockApiKeyRepository.getApiKeyById).toHaveBeenCalledWith(secretKeyId);
	// 		expect(mockApiKeyRepository.updateApiKey).toHaveBeenCalledWith({
	// 			id: secretKeyId,
	// 			key: "mocked_hashed_key_1234567890abcdef",
	// 			end: "efgh",
	// 			prefix: "vh_sk_test_",
	// 			environment: Environment.Testing,
	// 			updatedAt: expect.any(Date),
	// 			createdAt: expect.any(Date),
	// 		});
	// 	}));

	// 	it.effect("should fail when secret key is not found", Effect.gen(function* () {
	// 		const secretKeyId = "non_existent_id";

	// 		// Setup mocks
	// 		mockApiKeyRepository.setupGetApiKeyById(Effect.succeed(null));

	// 		const result = yield* pipe(
	// 			ApiKeyService.rotateSecretKey({ secretKeyId }),
	// 			Effect.provideService(ApiKeyRepository.Default, mockApiKeyRepository),
	// 			Effect.provideService(AuthSession.Default, createMockAuthSessionEffect(mockAuthSession)),
	// 			Effect.either
	// 		);

	// 		expect(result).toEqual(Effect.fail(new ApiKeyNotFoundError({
	// 			message: "Secret key not found",
	// 		})));
	// 	}));

	// 	it.effect("should fail when user lacks permission", Effect.gen(function* () {
	// 		const secretKeyId = "api_sk_mocked_id_1234567890";

	// 		// Setup mocks
	// 		mockApiKeyRepository.setupGetApiKeyById(Effect.succeed(mockApiKey));
	// 		vi.mocked(checkProjectPermission).mockImplementation(createMockCheckProjectPermission(false));

	// 		const result = yield* pipe(
	// 			ApiKeyService.rotateSecretKey({ secretKeyId }),
	// 			Effect.provideService(ApiKeyRepository.Default, mockApiKeyRepository),
	// 			Effect.provideService(AuthSession.Default, createMockAuthSessionEffect(mockAuthSession)),
	// 			Effect.either
	// 		);

	// 		expect(result).toEqual(Effect.fail(new Error("Permission denied")));
	// 	}));
	// });
});
