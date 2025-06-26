import { Effect, pipe } from "effect";
import { ApiKeyRepository } from "./api-key-repository";
import { AuthSession } from "@/lib/effect/auth";
import { Environment } from "@/lib/effect/environment";
import { checkProjectPermission } from "@/lib/effect/permissions";
import { NotFoundError } from "@/lib/effect/errors";
import { createSecretKey } from "./actions/create-secret-key";
import { deleteSecretKey } from "./actions/delete-secret-key";
import { rotateSecretKey } from "./actions/rotate-secret-key";

export class ApiKeyService extends Effect.Service<ApiKeyService>()(
	"ApiKeyService",
	{
		effect: Effect.gen(function* () {
			const apiKeyRepository = yield* ApiKeyRepository;
			return {
				createSecretKey,
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
				deleteSecretKey,
				rotateSecretKey,
			};
		}),

		// Specify dependencies
		dependencies: [ApiKeyRepository.Default],
	}
) {}
