import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { VoidhashError } from "@voidhash/lib";
import { z } from "zod";
import { createSecretKey } from "@/lib/services/api-keys/utils";
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
			throw new VoidhashError({
				code: "NOT_FOUND",
				message: "API key not found",
			});
		}

		if (
			!hasProjectPermission(authenticatedContext, existingKey.projectId, "")
		) {
			throw new VoidhashError({
				code: "FORBIDDEN",
				message: "You are not authorized to rotate this api key",
			});
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
