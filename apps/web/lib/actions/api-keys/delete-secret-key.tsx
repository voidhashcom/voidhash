"use server";

import { NotFoundError } from "@voidhash/lib";
import { authActionClient } from "@/features/lib/safe-action";
import { getApiKeyById } from "@/lib/queries/cached-queries";
import { z } from "zod";
import { apiKeys, db } from "@voidhash/db";
import { eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";

const deleteSecretKeySchema = z.object({
	secretKeyId: z.string(),
});

export const deleteSecretKey = authActionClient
	.schema(deleteSecretKeySchema)
	.action(async ({ parsedInput }) => {
		const existingKey = await getApiKeyById(parsedInput.secretKeyId);
		if (!existingKey) {
			throw new NotFoundError("API key not found");
		}

		await db.delete(apiKeys).where(eq(apiKeys.id, existingKey.id));

		revalidateTag(`api-keys_${existingKey.projectId}`);
		revalidateTag(`api-key_${existingKey.id}`);
	});
