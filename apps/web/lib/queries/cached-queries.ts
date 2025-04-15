import "server-only";

import { cache } from "react";
import {
	getApiKeyByIdQuery,
	getApiKeysQuery,
	getOrganizationByIdQuery,
	getOrganizationBySlugQuery,
	getProjectByIdQuery,
	getProjectBySlugQuery,
	getProjectsByIdQuery,
} from "./queries";
import { unstable_cache } from "next/cache";
import { auth } from "@voidhash/auth";
import { headers } from "next/headers";
import { NotFoundError, UnauthorizedError } from "@voidhash/lib/constants";
import { Environment } from "../environments/types";

// Session
export const getSession = cache(async () => {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	return session;
});

// User
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

export const getUsersOrganizations = cache(async () => {
	const organizations = await auth.api.listOrganizations({
		headers: await headers(),
	});

	return organizations;
});

// API Keys
export const getApiKeyById = cache(async (id: string) => {
	const userPromise = getUser();
	const apiKeyPromise = unstable_cache(
		async (keyId: string) => {
			return getApiKeyByIdQuery(keyId);
		},
		["api-key", id],
		{
			tags: [`api-key_${id}`],
			revalidate: 3600,
		}
	)(id);

	const [user, apiKey] = await Promise.all([userPromise, apiKeyPromise]);

	if (!apiKey) {
		return null;
	}

	const project = await getProjectById(apiKey.projectId);
	if (!project) {
		return null;
	}

	// Check if user has access to this organization
	if (!user?.organizations.some((c) => c.id === project.organizationId)) {
		return null;
	}

	return apiKey;
});

export const getApiKeys = cache(
	async (projectId: string, environment?: Environment) => {
		const userPromise = getUser();
		const projectPromise = getProjectById(projectId);
		const [user, project] = await Promise.all([userPromise, projectPromise]);

		if (!project) {
			throw new NotFoundError("Project not found");
		}

		if (!user) {
			throw new UnauthorizedError("User not found");
		}

		const apiKeys = await unstable_cache(
			async (projectId: string) => {
				return getApiKeysQuery(projectId);
			},
			["api-keys", project.id],
			{
				tags: [`api-keys_${project.id}`],
				revalidate: 3600,
			}
		)(project.id);

		if (environment) {
			const availableApiKeys = apiKeys.filter(
				(key) => key.environment === environment
			);

			return availableApiKeys;
		}

		return apiKeys;
	}
);

// Organizations
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

// Projects
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
