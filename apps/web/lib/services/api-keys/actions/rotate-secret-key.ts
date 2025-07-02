import { AuthSession } from "@/lib/effect/auth";
import { checkProjectPermission } from "@/lib/effect/permissions";
import { Data, Effect, pipe, Schema } from "effect";
import { ApiKeyRepository } from "../api-key.repository";
import { createSecretKey as generateSecretKeyFn } from "../effect/utils";

export class ApiKeyNotFoundError extends Data.TaggedError(
    "ApiKeyNotFoundError"
)<{
    readonly cause?: unknown;
    readonly message: string;
}> {}

export const rotateSecretKeyInputSchema = Schema.Struct({
	secretKeyId: Schema.String,
});

type RotateSecretKeyInput = Schema.Schema.Type<typeof rotateSecretKeyInputSchema>;

export const rotateSecretKey = (inputUnsafe: RotateSecretKeyInput) =>
	pipe(
		Effect.gen(function* () {
			const session = yield* AuthSession;
			const apiKeyRepository = yield* ApiKeyRepository;
			const input = Schema.decodeUnknownSync(rotateSecretKeyInputSchema)(
				inputUnsafe
			);

            const existingKey = yield* apiKeyRepository.getApiKeyById(input.secretKeyId);
            if (!existingKey) {
                return yield* Effect.fail(new ApiKeyNotFoundError({
                    message: "Secret key not found",
                }));
            }

			// SECURITY: Authorization check
			yield* checkProjectPermission(
				existingKey.projectId,
				"project:all",
				`User ${session?.user?.id} is not authorized to rotate secret key ${input.secretKeyId} for project ${existingKey.projectId}`
			);

			const { rawKey, ...newKey } = yield* generateSecretKeyFn(existingKey.environment);
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
	);
