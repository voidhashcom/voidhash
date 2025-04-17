import { createServiceFunction } from "@/lib/service-function";
import { z } from "zod";
import {
	getOrganizationByIdQuery,
	getOrganizationBySlugQuery,
} from "./raw-queries";
import { cache } from "react";
import { auth } from "@voidhash/auth";
import { getUser } from "../users/queries";

export const getOrganizationBySlugInputSchema = z.object({
	slug: z.string(),
});
export const getOrganizationBySlug = cache(
	createServiceFunction()
		.input(getOrganizationBySlugInputSchema)
		.function(async ({ ctx, input }) => {
			const userPromise = getUser({ ctx });
			const organizationPromise = ctx.cache.cacheFn(
				async (s: string) => {
					return getOrganizationBySlugQuery(s);
				},
				["organization", input.slug],
				{
					tags: [`organization_slug:${input.slug}`],
					revalidate: 3600,
				}
			)(input.slug);

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
		})
);

export const getOrganizationByIdInputSchema = z.object({
	id: z.string(),
});
export const getOrganizationById = cache(
	createServiceFunction()
		.input(getOrganizationByIdInputSchema)
		.function(async ({ ctx, input }) => {
			const userPromise = getUser({ ctx });
			const organizationPromise = ctx.cache.cacheFn(
				async (id: string) => {
					return getOrganizationByIdQuery(id);
				},
				["organization", input.id],
				{
					tags: [`organization_${input.id}`],
					revalidate: 3600,
				}
			)(input.id);

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
