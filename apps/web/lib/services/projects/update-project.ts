import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { z } from "zod";
import { getProjectById } from "./queries";
import { VoidhashError } from "@voidhash/lib";
import { projects } from "@voidhash/db";
import { eq } from "drizzle-orm";

export const updateProjectInputSchema = z.object({
	id: z.string(),
	name: z.string().min(1).max(32),
});

export const updateProject = createServiceFunction()
	.input(updateProjectInputSchema)
	.function(async ({ input, ctx }) => {
		const authenticatedContext = await authenticateContext(ctx);
		const project = await getProjectById({
			ctx: authenticatedContext,
			input: {
				id: input.id,
			},
		});
		if (!project) {
			throw new VoidhashError({
				code: "NOT_FOUND",
				message: "Project not found",
			});
		}

		if (!hasProjectPermission(authenticatedContext, project.id, "")) {
			throw new VoidhashError({
				code: "FORBIDDEN",
				message: "You are not authorized to update this project",
			});
		}

		await ctx.db
			.update(projects)
			.set({
				name: input.name,
			})
			.where(eq(projects.id, input.id));

		ctx.cache.invalidate(`project_${project.id}`);
		ctx.cache.invalidate(
			`project_${project.organizationId}_slug:${project.slug}`
		);
		ctx.cache.invalidate(`projects_${project.organizationId}`);
	});
