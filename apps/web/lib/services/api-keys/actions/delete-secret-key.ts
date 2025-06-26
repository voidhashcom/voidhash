import { AuthSession } from "@/lib/effect/auth";
import { checkProjectPermission } from "@/lib/effect/permissions";
import { Data, Effect, pipe, Schema } from "effect";
import { ApiKeyRepository } from "../api-key-repository";

export class ApiKeyNotFoundError extends Data.TaggedError(
	"ApiKeyNotFoundError"
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}


export const deleteSecretKeyInputSchema = Schema.Struct({
	secretKeyId: Schema.String,
});

type DeleteSecretKeyInput = Schema.Schema.Type<typeof deleteSecretKeyInputSchema>;

export const deleteSecretKey = (inputUnsafe: DeleteSecretKeyInput) =>
	pipe(
		Effect.gen(function* () {
			const session = yield* AuthSession;
			const apiKeyRepository = yield* ApiKeyRepository;
			const input = Schema.decodeUnknownSync(deleteSecretKeyInputSchema)(
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
				`User ${session?.user?.id} is not authorized to delete secret key ${input.secretKeyId} for project ${existingKey.projectId}`
			);

            yield* apiKeyRepository.deleteApiKey(input.secretKeyId);
		}),
		AuthSession.withAuthSession()
	);
