import "server-only";

import { organization } from "@voidhash/db";
import { eq } from "drizzle-orm";
import { ServiceContext } from "@/lib/service-function";

export const getOrganizationBySlugQuery = async (
	ctx: ServiceContext,
	slug: string
) => {
	return await ctx.db.query.organization.findFirst({
		where: eq(organization.slug, slug),
	});
};

export const getOrganizationByIdQuery = async (
	ctx: ServiceContext,
	id: string
) => {
	return await ctx.db.query.organization.findFirst({
		where: eq(organization.id, id),
	});
};
