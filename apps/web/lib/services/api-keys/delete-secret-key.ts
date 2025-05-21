import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import {
	VoidhashUnauthorizedError,
	VoidhashInternalServerError,
	VoidhashNotFoundError,
	VoidhashForbiddenError,
} from "@voidhash/lib";
import { z } from "zod";
import { apiKeys } from "@voidhash/db";
import { eq } from "drizzle-orm";
import { err, ok, Result } from "neverthrow";
import { getApiKeyByIdQuery } from "./raw-queries";

export const deleteSecretKeyInputSchema = z.object({
	secretKeyId: z.string(),
});

type DeleteSecretKeyError =
	| VoidhashUnauthorizedError
	| VoidhashInternalServerError
	| VoidhashNotFoundError
	| VoidhashForbiddenError;

export const deleteSecretKey = createServiceFunction()
	.input(deleteSecretKeyInputSchema)
	.function(
		async ({ input, ctx }): Promise<Result<void, DeleteSecretKeyError>> => {
			const authenticatedContext = await authenticateContext(ctx);

			if (authenticatedContext.isErr()) {
				return err(authenticatedContext.error);
			}

			const existingKey = await getApiKeyByIdQuery(
				authenticatedContext.value,
				input.secretKeyId
			);

			if (existingKey.isErr()) {
				return err(existingKey.error);
			}

			if (
				!hasProjectPermission(
					authenticatedContext.value,
					existingKey.value.projectId,
					"project:all"
				)
			) {
				return err({
					code: "FORBIDDEN",
					message: "You are not authorized to delete this api key",
					resource: "api-key",
					payload: { id: input.secretKeyId },
				});
			}

			try {
				await ctx.db
					.delete(apiKeys)
					.where(eq(apiKeys.id, existingKey.value.id));
			} catch (error) {
				return err({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to delete api key",
					originalError: error,
					resource: "api-key",
				});
			}

			ctx.cache.invalidate(`api-keys_${existingKey.value.projectId}`);
			ctx.cache.invalidate(`api-key_${existingKey.value.id}`);

			return ok(undefined);
		}
	);
