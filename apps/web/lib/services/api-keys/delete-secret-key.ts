import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { VoidhashError } from "@voidhash/lib";
import { z } from "zod";
import { apiKeys } from "@voidhash/db";
import { eq } from "drizzle-orm";
import { getApiKeyById } from "./queries";

export const deleteSecretKeyInputSchema = z.object({
	secretKeyId: z.string(),
});

export const deleteSecretKey = createServiceFunction()
	.input(deleteSecretKeyInputSchema)
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
				code: "UNAUTHORIZED",
				message: "You are not authorized to delete this api key",
			});
		}

		await ctx.db.delete(apiKeys).where(eq(apiKeys.id, existingKey.id));

		ctx.cache.invalidate(`api-keys_${existingKey.projectId}`);
		ctx.cache.invalidate(`api-key_${existingKey.id}`);

		return { success: true };
	});
