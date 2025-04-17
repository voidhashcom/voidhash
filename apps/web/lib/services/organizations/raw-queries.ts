import "server-only";

import { db, organization } from "@voidhash/db";
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
