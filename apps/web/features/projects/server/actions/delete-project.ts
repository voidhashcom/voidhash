"use server";

import { authActionClient } from "../../../lib/safe-action";
import { deleteProjectSchema } from "../schema";
import { db, projects } from "@voidhash/db";
import { eq } from "drizzle-orm";

export const deleteProject = authActionClient
	.schema(deleteProjectSchema)
	.action(async ({ parsedInput }) => {
		// TODO: Add authorization
		await db.delete(projects).where(eq(projects.id, parsedInput.projectId));
	});
