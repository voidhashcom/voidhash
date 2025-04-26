import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { NotFoundError, UnauthorizedError } from "@voidhash/lib";
import { z } from "zod";
import { createSecretKey } from "@/lib/api-keys/utils";
import { apiKeys } from "@voidhash/db";
import { eq } from "drizzle-orm";
import { getApiKeyById } from "./queries";

export const rotateSecretKeyInputSchema = z.object({
	secretKeyId: z.string(),
});

export const rotateSecretKey = createServiceFunction()
	.input(rotateSecretKeyInputSchema)
	.function(async ({ input, ctx }) => {
		const authenticatedContext = await authenticateContext(ctx);

		const existingKey = await getApiKeyById({
			ctx: authenticatedContext,
			input: { id: input.secretKeyId },
		});

		if (!existingKey) {
			throw new NotFoundError("API key not found");
		}

		if (
			!hasProjectPermission(authenticatedContext, existingKey.projectId, "")
		) {
			throw new UnauthorizedError(
				"You are not authorized to rotate this api key"
			);
		}

		const { rawKey, ...newKey } = await createSecretKey(
			existingKey.environment
		);

		await ctx.db
			.update(apiKeys)
			.set({
				...newKey,
				updatedAt: new Date(),
				createdAt: new Date(),
			})
			.where(eq(apiKeys.id, existingKey.id));

		ctx.cache.invalidate(`api-keys_${existingKey.projectId}`);
		ctx.cache.invalidate(`api-key_${existingKey.id}`);

		return { ...newKey, rawKey };
	});
