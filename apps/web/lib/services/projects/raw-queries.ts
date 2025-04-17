import "server-only";

import { db, projects } from "@voidhash/db";
import { and, eq } from "drizzle-orm";

export const getProjectBySlugQuery = async (
	organizationId,
	projectSlug: string
) => {
	return db.query.projects.findFirst({
		where: and(
			eq(projects.slug, projectSlug),
			eq(projects.organizationId, organizationId)
		),
	});
};

export const getProjectByIdQuery = async (id: string) => {
	return db.query.projects.findFirst({
		where: eq(projects.id, id),
	});
};

export const getProjectsByIdQuery = async (organizationId: string) => {
	return db.query.projects.findMany({
		where: eq(projects.organizationId, organizationId),
	});
};
