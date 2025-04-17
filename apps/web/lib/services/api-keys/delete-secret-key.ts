import { createServiceFunction } from "@/lib/service-function";
import { NotFoundError } from "@voidhash/lib";
import { z } from "zod";
import { apiKeys, db } from "@voidhash/db";
import { eq } from "drizzle-orm";
import { getApiKeyById } from "./queries";

export const deleteSecretKeyInputSchema = z.object({
	secretKeyId: z.string(),
});

export const deleteSecretKey = createServiceFunction()
	.input(deleteSecretKeyInputSchema)
	.function(async ({ input, ctx }) => {
		const existingKey = await getApiKeyById({
			ctx,
			input: { id: input.secretKeyId },
		});

		if (!existingKey) {
			throw new NotFoundError("API key not found");
		}

		await db.delete(apiKeys).where(eq(apiKeys.id, existingKey.id));

		ctx.cache.invalidate(`api-keys_${existingKey.projectId}`);
		ctx.cache.invalidate(`api-key_${existingKey.id}`);

		return { success: true };
	});
