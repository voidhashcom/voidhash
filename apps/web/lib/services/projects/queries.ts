import { createServiceFunction } from "@/lib/service-function";
import { z } from "zod";
import {
	getProjectByIdQuery,
	getProjectBySlugQuery,
	getProjectsByIdQuery,
} from "./raw-queries";
import { cache } from "react";
import { getOrganizationBySlug } from "../organizations/queries";
import { getUser } from "../users/queries";

export const getProjectBySlug = cache(
	createServiceFunction()
		.input(
			z.object({
				organizationId: z.string(),
				slug: z.string(),
			})
		)
		.function(async ({ input, ctx }) => {
			const userPromise = getUser({ ctx });
			const projectPromise = ctx.cache.cacheFn(
				async (organizationId: string, projectSlug: string) => {
					return getProjectBySlugQuery(organizationId, projectSlug);
				},
				["project", input.organizationId, input.slug],
				{
					tags: [`project_${input.organizationId}_slug:${input.slug}`],
					revalidate: 3600,
				}
			)(input.organizationId, input.slug);

			const [user, project] = await Promise.all([userPromise, projectPromise]);

			// Check if user has access to this organization
			if (user?.organizations.some((c) => c.id === project?.organizationId)) {
				return project;
			}

			return null;
		})
);

export const getProjectBySlugAndOrganizationSlug = cache(
	createServiceFunction()
		.input(
			z.object({
				organizationSlug: z.string(),
				projectSlug: z.string(),
			})
		)
		.function(async ({ input, ctx }) => {
			const organization = await getOrganizationBySlug({
				ctx,
				input: {
					slug: input.organizationSlug,
				},
			});

			if (!organization) {
				return null;
			}

			return await getProjectBySlug({
				ctx,
				input: {
					organizationId: organization.id,
					slug: input.projectSlug,
				},
			});
		})
);

export const getProjectById = cache(
	createServiceFunction()
		.input(
			z.object({
				id: z.string(),
			})
		)
		.function(async ({ input, ctx }) => {
			const userPromise = getUser({ ctx });
			const projectPromise = ctx.cache.cacheFn(
				async (id: string) => {
					return getProjectByIdQuery(id);
				},
				["project", input.id],
				{
					tags: [`project_${input.id}`],
					revalidate: 3600,
				}
			)(input.id);

			const [user, project] = await Promise.all([userPromise, projectPromise]);

			// Check if user has access to this organization
			if (user?.organizations.some((c) => c.id === project?.organizationId)) {
				return project;
			}

			return null;
		})
);

export const getProjectsByOrganizationSlug = cache(
	createServiceFunction()
		.input(
			z.object({
				slug: z.string(),
			})
		)
		.function(async ({ input, ctx }) => {
			const organization = await getOrganizationBySlug({
				ctx,
				input: {
					slug: input.slug,
				},
			});

			if (!organization) return [];

			return await ctx.cache.cacheFn(
				async (orgId: string) => {
					return getProjectsByIdQuery(orgId);
				},
				["projects", organization.id],
				{
					tags: [`projects_${organization.id}`],
					revalidate: 3600,
				}
			)(organization.id);
		})
);
