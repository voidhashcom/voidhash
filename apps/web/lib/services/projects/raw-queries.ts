import "server-only";

import { projects } from "@voidhash/db";
import { and, eq } from "drizzle-orm";
import { ServiceContext } from "@/lib/service-function";

export const getProjectBySlugQuery = async (
	ctx: ServiceContext,
	organizationId,
	projectSlug: string
) => {
	return ctx.db.query.projects.findFirst({
		where: and(
			eq(projects.slug, projectSlug),
			eq(projects.organizationId, organizationId)
		),
	});
};

export const getProjectByIdQuery = async (ctx: ServiceContext, id: string) => {
	return ctx.db.query.projects.findFirst({
		where: eq(projects.id, id),
	});
};

export const getProjectsByIdQuery = async (
	ctx: ServiceContext,
	organizationId: string
) => {
	return ctx.db.query.projects.findMany({
		where: eq(projects.organizationId, organizationId),
	});
};
