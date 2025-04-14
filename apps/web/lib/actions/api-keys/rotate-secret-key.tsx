"use server";

import { NotFoundError } from "@voidhash/lib";
import { authActionClient } from "@/features/lib/safe-action";
import {
	getApiKeyById,
	getOrganizationById,
	getProjectById,
} from "@/lib/queries/cached-queries";
import { z } from "zod";
import { createSecretKey } from "@/lib/api-keys/utils";
import { apiKeys, db } from "@voidhash/db";
import { eq } from "drizzle-orm";

const rotateSecretKeySchema = z.object({
	secretKeyId: z.string(),
});

export const rotateSecretKey = authActionClient
	.schema(rotateSecretKeySchema)
	.action(async ({ parsedInput }) => {
		const project = await getProjectById(parsedInput.secretKeyId);
		if (!project) {
			throw new NotFoundError("Project not found");
		}
		const organization = await getOrganizationById(project.organizationId);
		if (!organization) {
			throw new NotFoundError("Organization not found");
		}

		if (!organization.slug) {
			throw new Error("Organization slug not found - " + organization.id);
		}

		const existingKey = await getApiKeyById(parsedInput.secretKeyId);
		if (!existingKey) {
			throw new NotFoundError("API key not found");
		}

		const newKey = await createSecretKey(existingKey.environment);

		await db
			.update(apiKeys)
			.set({
				...newKey,
				updatedAt: new Date(),
				createdAt: new Date(),
			})
			.where(eq(apiKeys.id, existingKey.id));
	});
