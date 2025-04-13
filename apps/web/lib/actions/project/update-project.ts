"use server";

import { z } from "zod";
import { authActionClient } from "../../../features/lib/safe-action";
import { db, projects } from "@voidhash/db";
import { eq } from "drizzle-orm";
import { getProjectById } from "@/lib/queries/cached-queries";
import { NotFoundError } from "@/features/lib/errors";
import { revalidateTag } from "next/cache";

const updateProjectSchema = z.object({
	projectId: z.string(),
	name: z.string().min(1).max(32),
});

export const updateProject = authActionClient
	.schema(updateProjectSchema)
	.action(async ({ parsedInput }) => {
		const project = await getProjectById(parsedInput.projectId);
		if (!project) {
			throw new NotFoundError("Project not found");
		}

		await db
			.update(projects)
			.set({
				name: parsedInput.name,
			})
			.where(eq(projects.id, parsedInput.projectId));

		revalidateTag(`project_${project.id}`);
		revalidateTag(`project_slug:${project.slug}`);
		revalidateTag(`projects_${project.organizationId}`);
	});
