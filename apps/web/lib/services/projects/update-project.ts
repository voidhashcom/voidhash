import { createServiceFunction } from "@/lib/service-function";
import { z } from "zod";
import { getProjectById } from "./queries";
import { NotFoundError } from "@voidhash/lib/constants";
import { db, projects } from "@voidhash/db";
import { eq } from "drizzle-orm";

export const updateProjectInputSchema = z.object({
	id: z.string(),
	name: z.string().min(1).max(32),
});

export const updateProject = createServiceFunction()
	.input(updateProjectInputSchema)
	.function(async ({ input, ctx }) => {
		const project = await getProjectById({
			ctx,
			input: {
				id: input.id,
			},
		});
		if (!project) {
			throw new NotFoundError("Project not found");
		}

		await db
			.update(projects)
			.set({
				name: input.name,
			})
			.where(eq(projects.id, input.id));

		ctx.cache.invalidate(`project_${project.id}`);
		ctx.cache.invalidate(`project_slug:${project.slug}`);
		ctx.cache.invalidate(`projects_${project.organizationId}`);
	});
