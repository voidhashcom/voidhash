import { createServiceFunction } from "@/lib/service-function";
import { z } from "zod";
import { getProjectById } from "./queries";
import { NotFoundError } from "@voidhash/lib/constants";
import { db, projects } from "@voidhash/db";
import { eq } from "drizzle-orm";
import { getOrganizationById } from "../organizations/queries";

export const deleteProjectInputSchema = z.object({
	id: z.string(),
});

export const deleteProject = createServiceFunction()
	.input(deleteProjectInputSchema)
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

		const organization = await getOrganizationById({
			ctx,
			input: {
				id: project.organizationId,
			},
		});

		if (!organization) {
			throw new Error("Organization not found");
		}

		await db.delete(projects).where(eq(projects.id, input.id));

		ctx.cache.invalidate(`project_${project.id}`);
		ctx.cache.invalidate(`project_${organization.id}_slug:${project.slug}`);
		ctx.cache.invalidate(`projects_${project.organizationId}`);
	});
