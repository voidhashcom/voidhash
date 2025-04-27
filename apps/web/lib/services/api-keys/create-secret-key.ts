import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { VoidhashError } from "@voidhash/lib";
import { z } from "zod";
import { getOrganizationById } from "../organizations/queries";
import { getProjectById } from "../projects/queries";
import { getEnvironment } from "@/lib/services/environments/utils";
import { createSecretKey as generateSecretKeyFn } from "@/lib/services/api-keys/utils";
import { apiKeys } from "@voidhash/db";
import { generateId } from "@/lib/id/generate";

export const createSecretKeyInputSchema = z.object({
	projectId: z.string(),
	name: z.string().min(3, "Name must be at least 3 characters long"),
});

export const createSecretKey = createServiceFunction()
	.input(createSecretKeyInputSchema)
	.function(async ({ input, ctx }) => {
		const authenticatedContext = await authenticateContext(ctx);
		if (!hasProjectPermission(authenticatedContext, input.projectId, "")) {
			throw new VoidhashError({
				code: "FORBIDDEN",
				message: "You are not authorized to create an api key for this project",
			});
		}

		const project = await getProjectById({
			ctx: authenticatedContext,
			input: { id: input.projectId },
		});

		if (!project) {
			throw new VoidhashError({
				code: "NOT_FOUND",
				message: "Project not found",
			});
		}

		const organization = await getOrganizationById({
			ctx: authenticatedContext,
			input: { id: project.organizationId },
		});

		if (!organization) {
			throw new VoidhashError({
				code: "NOT_FOUND",
				message: "Organization not found",
			});
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
		await ctx.db.insert(apiKeys).values({
			id: generateId("apiSecretKey"),
			projectId: project.id,
			name: input.name,
			...secretKey,
		});

		ctx.cache.invalidate(`api-keys_${project.id}`);

		return { ...secretKey, rawKey };
	});
