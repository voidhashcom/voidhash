import { Data, Effect, pipe } from "effect";
import { ApiKeyRepository } from "../repositories/api-key.repository";
import { AuthSession } from "@/lib/effect/auth";
import { Environment } from "@/lib/effect/environment";
import { checkProjectPermission } from "@/lib/effect/permissions";
import { NotFoundError } from "@/lib/effect/errors";
import { createSecretKey as generateSecretKeyFn } from "../core/api-keys/effect/utils";
import { generateId } from "@/lib/id/generate";

export class ApiKeyNotFoundError extends Data.TaggedError(
	"ApiKeyNotFoundError"
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export class ApiKeyService extends Effect.Service<ApiKeyService>()(
	"ApiKeyService",
	{
		effect: Effect.gen(function* () {
			const apiKeyRepository = yield* ApiKeyRepository;
			return {
				createSecretKey: (input: {
					projectId: string;
					name: string;
				}) =>
					pipe(
						Effect.gen(function* () {
							const session = yield* AuthSession;
							const environment = yield* Environment;
							const apiKeyRepository = yield* ApiKeyRepository;
					
							// SECURITY: Authorization check
							yield* checkProjectPermission(
								input.projectId,
								"project:all",
								`User ${session?.user?.id} is not authorized to create secret keys for project ${input.projectId}`
							);
				
							const { rawKey, ...secretKey } = yield* generateSecretKeyFn(environment);
							const apiKeyId = generateId("apiSecretKey");
							yield* apiKeyRepository.createApiKey({
								id: apiKeyId,
								projectId: input.projectId,
								name: input.name,
								...secretKey,
							});
				
							const apiKey = yield* apiKeyRepository.getApiKeyById(apiKeyId);
							if (!apiKey) {
								return yield* Effect.fail(
									new ApiKeyNotFoundError({
										message: "API key not found",
									})
								);
							}
				
							return {
								...apiKey,
								rawKey,
							};
						}),
						Environment.withEnvironment({
							projectId: input.projectId,
						}),
						AuthSession.withAuthSession()
					)
				,
				getApiKeys: (projectId: string) =>
					pipe(
						Effect.gen(function* () {
							const session = yield* AuthSession;
							const environment = yield* Environment;
							// SECURITY: Authorization check
							yield* checkProjectPermission(
								projectId,
								"project:all",
								`User ${session?.user?.id} is not authorized to access api keys for project ${projectId}`
							);
							const apiKeys = yield* apiKeyRepository.getApiKeys(projectId);
							return apiKeys.filter((key) => key.environment === environment);
						}),
						Environment.withEnvironment({
							projectId,
						}),
						AuthSession.withAuthSession()
					),
				getApiKeyById: (id: string) =>
					pipe(
						Effect.gen(function* () {
							const session = yield* AuthSession;

							const apiKey = yield* apiKeyRepository.getApiKeyById(id);
							if (!apiKey) {
								return yield* Effect.fail(
									new NotFoundError({
										message: "API key not found",
									})
								);
							}

							// SECURITY: Authorization check
							yield* checkProjectPermission(
								apiKey.projectId,
								"project:all",
								`User ${session?.user?.id} is not authorized to access api key ${id} for project ${apiKey.projectId}`
							);

							return apiKey;
						}),

						AuthSession.withAuthSession()
					),
				deleteSecretKey: (input: {
					secretKeyId: string;
				}) =>
					pipe(
						Effect.gen(function* () {
							const session = yield* AuthSession;
							const apiKeyRepository = yield* ApiKeyRepository;
				
							const existingKey = yield* apiKeyRepository.getApiKeyById(
								input.secretKeyId
							);
							if (!existingKey) {
								return yield* Effect.fail(
									new ApiKeyNotFoundError({
										message: "Secret key not found",
									})
								);
							}
				
							// SECURITY: Authorization check
							yield* checkProjectPermission(
								existingKey.projectId,
								"project:all",
								`User ${session?.user?.id} is not authorized to delete secret key ${input.secretKeyId} for project ${existingKey.projectId}`
							);
				
							yield* apiKeyRepository.deleteApiKey(input.secretKeyId);
						}),
						AuthSession.withAuthSession()
					),
				
				rotateSecretKey: (input: {
					secretKeyId: string;
				}) =>
					pipe(
						Effect.gen(function* () {
							const session = yield* AuthSession;
							const apiKeyRepository = yield* ApiKeyRepository;
				
							const existingKey = yield* apiKeyRepository.getApiKeyById(
								input.secretKeyId
							);
							if (!existingKey) {
								return yield* Effect.fail(
									new ApiKeyNotFoundError({
										message: "Secret key not found",
									})
								);
							}
				
							// SECURITY: Authorization check
							yield* checkProjectPermission(
								existingKey.projectId,
								"project:all",
								`User ${session?.user?.id} is not authorized to rotate secret key ${input.secretKeyId} for project ${existingKey.projectId}`
							);
				
							const { rawKey, ...newKey } = yield* generateSecretKeyFn(
								existingKey.environment
							);
							yield* apiKeyRepository.updateApiKey({
								id: input.secretKeyId,
								...newKey,
								updatedAt: new Date(),
								createdAt: new Date(),
							});
				
							return {
								...existingKey,
								...newKey,
								rawKey,
							};
						}),
						AuthSession.withAuthSession()
					),
				
			};
		}),

		// Specify dependencies
		dependencies: [ApiKeyRepository.Default],
	}
) {}
