import "server-only";

import { db, organization, projects } from "@voidhash/db";
import { eq } from "drizzle-orm";

export const getOrganizationBySlugQuery = async (slug: string) => {
	return await db.query.organization.findFirst({
		where: eq(organization.slug, slug),
	});
};

export const getOrganizationByIdQuery = async (id: string) => {
	return await db.query.organization.findFirst({
		where: eq(organization.id, id),
	});
};

export const getProjectBySlugQuery = async (slug: string) => {
	return db.query.projects.findFirst({
		where: eq(projects.slug, slug),
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
