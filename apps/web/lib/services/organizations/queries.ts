import {
	authenticateContext,
	createServiceFunction,
	hasOrganizationPermission,
} from "@/lib/service-function";
import { z } from "zod";
import {
	getOrganizationByIdQuery,
	getOrganizationBySlugQuery,
} from "./raw-queries";
import { cache } from "react";
import { auth } from "@voidhash/auth";

export const getOrganizationBySlugInputSchema = z.object({
	slug: z.string(),
});
export const getOrganizationBySlug = cache(
	createServiceFunction()
		.input(getOrganizationBySlugInputSchema)
		.function(async ({ ctx, input }) => {
			const authenticatedContext = await authenticateContext(ctx);

			const organization = await ctx.cache.cacheFn(
				async (s: string) => {
					return getOrganizationBySlugQuery(s);
				},
				["organization", input.slug],
				{
					tags: [`organization_slug:${input.slug}`],
					revalidate: 3600,
				}
			)(input.slug);

			if (!organization) {
				return null;
			}

			if (
				!hasOrganizationPermission(authenticatedContext, organization.id, "")
			) {
				return null;
			}

			return organization;
		})
);

export const getOrganizationByIdInputSchema = z.object({
	id: z.string(),
});
export const getOrganizationById = cache(
	createServiceFunction()
		.input(getOrganizationByIdInputSchema)
		.function(async ({ ctx, input }) => {
			const authenticatedContext = await authenticateContext(ctx);

			const organization = await ctx.cache.cacheFn(
				async (id: string) => {
					return getOrganizationByIdQuery(id);
				},
				["organization", input.id],
				{
					tags: [`organization_${input.id}`],
					revalidate: 3600,
				}
			)(input.id);

			if (!organization) {
				return null;
			}

			if (
				!hasOrganizationPermission(authenticatedContext, organization.id, "")
			) {
				return null;
			}

			return organization;
		})
);

export const getUsersOrganizations = cache(
	createServiceFunction().function(async ({ ctx }) => {
		const organizations = await auth.api.listOrganizations({
			headers: ctx.headers,
		});

		return organizations;
	})
);
