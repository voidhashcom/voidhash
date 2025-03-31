import { getWebRequest } from "@tanstack/react-start/server";
import { auth } from "../../../auth/lib";
import { db, projects } from "@voidhash/db";
import { eq } from "drizzle-orm";
export async function deleteProject({
	request,
	data,
}: {
	request: Request;
	data: { projectId: string };
}) {
	// TODO: Add authorization
	await db.delete(projects).where(eq(projects.id, data.projectId));
}
