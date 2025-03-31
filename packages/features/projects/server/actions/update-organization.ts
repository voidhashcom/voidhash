import { eq } from "drizzle-orm";
import { projects } from "@voidhash/db";
import { db } from "@voidhash/db";
import { auth } from "../../../auth/lib";
export async function updateProject(
	request: Request,
	data: { projectId: string; name: string }
) {
	// TODO: Add authorization

	await db
		.update(projects)
		.set({
			name: data.name,
		})
		.where(eq(projects.id, data.projectId));
}
