import { AuthSession } from "@/lib/effect/auth";
import { Environment } from "@/lib/effect/environment";
import { checkProjectPermission } from "@/lib/effect/permissions";
import { Data, Effect, pipe, Schema } from "effect";
import { ApiKeyRepository } from "../api-key.repository";
import { createSecretKey as generateSecretKeyFn } from "../effect/utils";
import { generateId } from "@/lib/id/generate";

export class ApiKeyNotFoundError extends Data.TaggedError(
	"ApiKeyNotFoundError"
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export const createSecretKeyInputSchema = Schema.Struct({
	projectId: Schema.String,
	name: Schema.String.pipe(Schema.minLength(3), Schema.maxLength(32)),
});

type CreateSecretKeyInput = Schema.Schema.Type<
	typeof createSecretKeyInputSchema
>;

export const createSecretKey = (inputUnsafe: CreateSecretKeyInput) =>
	pipe(
		Effect.gen(function* () {
			const session = yield* AuthSession;
			const environment = yield* Environment;
			const apiKeyRepository = yield* ApiKeyRepository;
			const input = Schema.decodeUnknownSync(createSecretKeyInputSchema)(
				inputUnsafe
			);
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
				return yield* Effect.fail(new ApiKeyNotFoundError({
					message: "API key not found",
				}));
			}

			return {
				...apiKey,
				rawKey,
			};
		}),
		Environment.withEnvironment({
			projectId: inputUnsafe.projectId,
		}),
		AuthSession.withAuthSession()
	);
