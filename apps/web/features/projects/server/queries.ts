import "server-only";
import { db, projects } from "@voidhash/db";
import { eq } from "drizzle-orm";

export const getProjectBySlugQuery = async (slug: string) => {
	return db.query.projects.findFirst({
		where: eq(projects.slug, slug),
	});
};

export const getProjectsByIdQuery = async (organizationId: string) => {
	return db.query.projects.findMany({
		where: eq(projects.organizationId, organizationId),
	});
};
