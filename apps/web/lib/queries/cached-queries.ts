import "server-only";

import { cache } from "react";
import {
	getOrganizationByIdQuery,
	getOrganizationBySlugQuery,
	getProjectByIdQuery,
	getProjectBySlugQuery,
	getProjectsByIdQuery,
} from "./queries";
import { unstable_cache } from "next/cache";
import { auth } from "@voidhash/auth";
import { headers } from "next/headers";

export const getSession = cache(async () => {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	return session;
});

export const getUsersOrganizations = cache(async () => {
	const organizations = await auth.api.listOrganizations({
		headers: await headers(),
	});

	return organizations;
});

export const getUser = cache(async () => {
	const session = await getSession();

	if (!session?.user) {
		return null;
	}

	const organizations = await getUsersOrganizations();

	return {
		...session.user,
		organizations,
	};
});

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

export const getProjectById = cache(async (id: string) => {
	const userPromise = getUser();
	const projectPromise = unstable_cache(
		async (id: string) => {
			return getProjectByIdQuery(id);
		},
		["project", id],
		{
			tags: [`project_${id}`],
			revalidate: 3600,
		}
	)(id);

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
