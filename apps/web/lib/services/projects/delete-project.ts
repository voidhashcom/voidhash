import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { z } from "zod";
import { getProjectById } from "./queries";
import { NotFoundError, UnauthorizedError } from "@voidhash/lib/constants";
import { projects } from "@voidhash/db";
import { eq } from "drizzle-orm";
import { getOrganizationById } from "../organizations/queries";

export const deleteProjectInputSchema = z.object({
	id: z.string(),
});

export const deleteProject = createServiceFunction()
	.input(deleteProjectInputSchema)
	.function(async ({ input, ctx }) => {
		const authenticatedContext = await authenticateContext(ctx);
		if (!hasProjectPermission(authenticatedContext, input.id, "")) {
			throw new UnauthorizedError(
				"You are not authorized to delete this project"
			);
		}

		const project = await getProjectById({
			ctx: authenticatedContext,
			input: {
				id: input.id,
			},
		});

		if (!project) {
			throw new NotFoundError("Project not found");
		}

		const organization = await getOrganizationById({
			ctx: authenticatedContext,
			input: {
				id: project.organizationId,
			},
		});

		if (!organization) {
			throw new NotFoundError("Organization not found");
		}

		await ctx.db.delete(projects).where(eq(projects.id, input.id));

		ctx.cache.invalidate(`project_${project.id}`);
		ctx.cache.invalidate(`project_${organization.id}_slug:${project.slug}`);
		ctx.cache.invalidate(`projects_${project.organizationId}`);
	});
