import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import {
	VoidhashForbiddenError,
	VoidhashInternalServerError,
	VoidhashNotFoundError,
	VoidhashUnauthorizedError,
} from "@voidhash/lib";
import { z } from "zod";
import { createSecretKey } from "@/lib/services/api-keys/utils";
import { ApiKey, apiKeys } from "@voidhash/db";
import { eq } from "drizzle-orm";

import { err, ok, Result } from "neverthrow";

import { getApiKeyByIdQuery } from "./raw-queries";

export const rotateSecretKeyInputSchema = z.object({
	secretKeyId: z.string(),
});

type RotateSecretKeyError =
	| VoidhashUnauthorizedError
	| VoidhashInternalServerError
	| VoidhashForbiddenError
	| VoidhashNotFoundError;

export const rotateSecretKey = createServiceFunction()
	.input(rotateSecretKeyInputSchema)
	.function(
		async ({ input, ctx }): Promise<Result<ApiKey, RotateSecretKeyError>> => {
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
					message: "You are not authorized to rotate this api key",
					resource: "api-key",
					payload: { id: input.secretKeyId },
				});
			}

			const { rawKey, ...newKey } = await createSecretKey(
				existingKey.value.environment
			);

			try {
				await ctx.db
					.update(apiKeys)
					.set({
						...newKey,
						updatedAt: new Date(),
						createdAt: new Date(),
					})
					.where(eq(apiKeys.id, existingKey.value.id));
			} catch (error) {
				return err({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to rotate api key",
					originalError: error,
				});
			}
			ctx.cache.invalidate(`api-keys_${existingKey.value.projectId}`);
			ctx.cache.invalidate(`api-key_${existingKey.value.id}`);

			return ok({ ...existingKey.value, ...newKey, rawKey });
		}
	);
