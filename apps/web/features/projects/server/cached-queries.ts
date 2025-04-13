import "server-only";

import { cache } from "react";
import { getOrganizationBySlug } from "@/features/organizations/server/cached-queries";
import { getProjectBySlugQuery, getProjectsByIdQuery } from "./queries";
import { unstable_cache } from "next/cache";
import { getUser } from "@/features/auth/server/cached-queries";

export const getProjectBySlug = cache(async (slug: string) => {
	const userPromise = getUser();
	const projectPromise = unstable_cache(
		async (s: string) => {
			return getProjectBySlugQuery(s);
		},
		["project", slug],
		{
			tags: [`project_slug:${slug}`],
			revalidate: 3600,
		}
	)(slug);

	const [user, project] = await Promise.all([userPromise, projectPromise]);

	// Check if user has access to this organization
	if (user?.organizations.some((c) => c.id === project?.organizationId)) {
		return project;
	}

	return null;
});

export const getProjectsByOrganizationSlug = cache(async (slug: string) => {
	const organization = await getOrganizationBySlug(slug);
	if (!organization) return [];

	return await unstable_cache(
		async (orgId: string) => {
			return getProjectsByIdQuery(orgId);
		},
		["projects", organization.id],
		{
			tags: [`projects_${organization.id}`],
			revalidate: 3600,
		}
	)(organization.id);
});
