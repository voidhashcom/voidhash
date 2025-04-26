import {
	authenticateContext,
	createServiceFunction,
	hasOrganizationPermission,
	hasProjectPermission,
} from "@/lib/service-function";
import { z } from "zod";
import {
	getProjectByIdQuery,
	getProjectBySlugQuery,
	getProjectsByIdQuery,
} from "./raw-queries";
import { cache } from "react";
import { getOrganizationBySlug } from "../organizations/queries";

export const getProjectBySlug = cache(
	createServiceFunction()
		.input(
			z.object({
				organizationId: z.string(),
				slug: z.string(),
			})
		)
		.function(async ({ input, ctx }) => {
			const authenticatedContext = await authenticateContext(ctx);
			const project = await ctx.cache.cacheFn(
				async (organizationId: string, projectSlug: string) => {
					return getProjectBySlugQuery(
						authenticatedContext,
						organizationId,
						projectSlug
					);
				},
				["project", input.organizationId, input.slug],
				{
					tags: [`project_${input.organizationId}_slug:${input.slug}`],
					revalidate: 3600,
				}
			)(input.organizationId, input.slug);

			if (!project) {
				return null;
			}

			if (!hasProjectPermission(authenticatedContext, project.id, "")) {
				return null;
			}

			return project;
		}).invoke
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
			const authenticatedContext = await authenticateContext(ctx);
			const organization = await getOrganizationBySlug({
				ctx: authenticatedContext,
				input: {
					slug: input.organizationSlug,
				},
			});

			if (!organization) {
				return null;
			}

			const project = await getProjectBySlug({
				ctx: authenticatedContext,
				input: {
					organizationId: organization.id,
					slug: input.projectSlug,
				},
			});

			if (!project) {
				return null;
			}

			if (!hasProjectPermission(authenticatedContext, project.id, "")) {
				return null;
			}

			return project;
		}).invoke
);

export const getProjectById = cache(
	createServiceFunction()
		.input(
			z.object({
				id: z.string(),
			})
		)
		.function(async ({ input, ctx }) => {
			const authenticatedContext = await authenticateContext(ctx);
			const project = await ctx.cache.cacheFn(
				async (id: string) => {
					return getProjectByIdQuery(authenticatedContext, id);
				},
				["project", input.id],
				{
					tags: [`project_${input.id}`],
					revalidate: 3600,
				}
			)(input.id);

			if (!project) {
				return null;
			}

			if (!hasProjectPermission(authenticatedContext, project.id, "")) {
				return null;
			}

			return project;
		}).invoke
);

export const getProjectsByOrganizationSlug = cache(
	createServiceFunction()
		.input(
			z.object({
				slug: z.string(),
			})
		)
		.function(async ({ input, ctx }) => {
			const authenticatedContext = await authenticateContext(ctx);
			const organization = await getOrganizationBySlug({
				ctx: authenticatedContext,
				input: {
					slug: input.slug,
				},
			});

			if (!organization) {
				return [];
			}

			if (
				!hasOrganizationPermission(authenticatedContext, organization.id, "")
			) {
				return [];
			}

			return await ctx.cache.cacheFn(
				async (orgId: string) => {
					return getProjectsByIdQuery(authenticatedContext, orgId);
				},
				["projects", organization.id],
				{
					tags: [`projects_${organization.id}`],
					revalidate: 3600,
				}
			)(organization.id);
		}).invoke
);
