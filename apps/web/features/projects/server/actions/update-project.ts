"use server";

import { authActionClient } from "../../../lib/safe-action";
import { updateProjectSchema } from "../schema";
import { db, projects } from "@voidhash/db";
import { eq } from "drizzle-orm";

export const updateProject = authActionClient
	.schema(updateProjectSchema)
	.action(async ({ parsedInput }) => {
		// TODO: Add authorization
		await db
			.update(projects)
			.set({
				name: parsedInput.name,
			})
			.where(eq(projects.id, parsedInput.projectId));
	});
