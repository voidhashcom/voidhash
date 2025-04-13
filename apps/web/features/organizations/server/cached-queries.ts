import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import {
	getOrganizationByIdQuery,
	getOrganizationBySlugQuery,
} from "./queries";
import { getUser } from "@/features/auth/server/cached-queries";

export const getOrganizationBySlug = cache(async (slug: string) => {
	const userPromise = getUser();
	const organizationPromise = unstable_cache(
		async (s: string) => {
			return getOrganizationBySlugQuery(s);
		},
		["organization", slug],
		{
			tags: [`organization_slug:${slug}`],
			revalidate: 3600,
		}
	)(slug);

	const [user, organization] = await Promise.all([
		userPromise,
		organizationPromise,
	]);

	// Check if user has access to this organization
	if (
		organization &&
		user?.organizations.some((c) => c.id === organization.id)
	) {
		return organization;
	}

	return null;
});

export const getOrganizationById = cache(async (id: string) => {
	const userPromise = getUser();
	const organizationPromise = unstable_cache(
		async (id: string) => {
			return getOrganizationByIdQuery(id);
		},
		["organization", id],
		{
			tags: [`organization_${id}`],
			revalidate: 3600,
		}
	)(id);

	const [user, organization] = await Promise.all([
		userPromise,
		organizationPromise,
	]);

	// Check if user has access to this organization
	if (
		organization &&
		user?.organizations.some((c) => c.id === organization.id)
	) {
		return organization;
	}

	return null;
});
