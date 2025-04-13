"use server";

import { NotFoundError } from "@/features/lib/errors";
import { authActionClient } from "../../../features/lib/safe-action";
import { db, projects } from "@voidhash/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getProjectById } from "@/lib/queries/cached-queries";
import { revalidateTag } from "next/cache";

const deleteProjectSchema = z.object({
	projectId: z.string(),
});

export const deleteProject = authActionClient
	.schema(deleteProjectSchema)
	.action(async ({ parsedInput }) => {
		const project = await getProjectById(parsedInput.projectId);
		if (!project) {
			throw new NotFoundError("Project not found");
		}

		await db.delete(projects).where(eq(projects.id, parsedInput.projectId));

		revalidateTag(`project_${project.id}`);
		revalidateTag(`project_slug:${project.slug}`);
		revalidateTag(`projects_${project.organizationId}`);
	});
