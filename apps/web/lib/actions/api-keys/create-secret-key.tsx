"use server";

import { createId, NotFoundError } from "@voidhash/lib";
import { authActionClient } from "@/features/lib/safe-action";
import {
	getOrganizationById,
	getProjectById,
} from "@/lib/queries/cached-queries";
import { z } from "zod";
import { getEnvironment } from "@/lib/environments/utils";
import { createSecretKey as generateSecretKeyFn } from "@/lib/api-keys/utils";
import { apiKeys, db } from "@voidhash/db";

const createSecretKeySchema = z.object({
	projectId: z.string(),
	name: z.string().min(3, "Name must be at least 3 characters long"),
});

export const createSecretKey = authActionClient
	.schema(createSecretKeySchema)
	.action(async ({ parsedInput }) => {
		const project = await getProjectById(parsedInput.projectId);
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

		const environment = await getEnvironment(organization.slug, project.slug);
		const secretKey = await generateSecretKeyFn(environment);
		await db.insert(apiKeys).values({
			id: createId(),
			projectId: project.id,
			name: parsedInput.name,
			...secretKey,
		});
	});
