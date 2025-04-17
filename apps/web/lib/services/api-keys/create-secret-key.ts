import { createServiceFunction } from "@/lib/service-function";
import { createId, NotFoundError } from "@voidhash/lib";
import { z } from "zod";
import { getOrganizationById } from "../organizations/queries";
import { getProjectById } from "../projects/queries";
import { getEnvironment } from "@/lib/environments/utils";
import { createSecretKey as generateSecretKeyFn } from "@/lib/api-keys/utils";
import { apiKeys, db } from "@voidhash/db";

export const createSecretKeyInputSchema = z.object({
	projectId: z.string(),
	name: z.string().min(3, "Name must be at least 3 characters long"),
});

export const createSecretKey = createServiceFunction()
	.input(createSecretKeyInputSchema)
	.function(async ({ input, ctx }) => {
		const project = await getProjectById({
			ctx,
			input: { id: input.projectId },
		});
		if (!project) {
			throw new NotFoundError("Project not found");
		}

		const organization = await getOrganizationById({
			ctx,
			input: { id: project.organizationId },
		});
		if (!organization) {
			throw new NotFoundError("Organization not found");
		}

		if (!organization.slug) {
			throw new Error("Organization slug not found - " + organization.id);
		}

		const environment = await getEnvironment(
			ctx.cookies,
			organization.slug,
			project.slug
		);
		if (!environment) {
			throw new Error("Environment not found");
		}

		const { rawKey, ...secretKey } = await generateSecretKeyFn(environment);
		await db.insert(apiKeys).values({
			id: createId(),
			projectId: project.id,
			name: input.name,
			...secretKey,
		});

		ctx.cache.invalidate(`api-keys_${project.id}`);

		return { ...secretKey, rawKey };
	});
