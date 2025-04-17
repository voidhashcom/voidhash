import { createServiceFunction } from "@/lib/service-function";
import { NotFoundError } from "@voidhash/lib";
import { z } from "zod";
import { createSecretKey } from "@/lib/api-keys/utils";
import { apiKeys, db } from "@voidhash/db";
import { eq } from "drizzle-orm";
import { getApiKeyById } from "./queries";

export const rotateSecretKeyInputSchema = z.object({
	secretKeyId: z.string(),
});

export const rotateSecretKey = createServiceFunction()
	.input(rotateSecretKeyInputSchema)
	.function(async ({ input, ctx }) => {
		const existingKey = await getApiKeyById({
			ctx,
			input: { id: input.secretKeyId },
		});

		if (!existingKey) {
			throw new NotFoundError("API key not found");
		}

		const { rawKey, ...newKey } = await createSecretKey(
			existingKey.environment
		);

		await db
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
