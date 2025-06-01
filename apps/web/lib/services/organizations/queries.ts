import {
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
import { err, ok, Result, ResultAsync } from "neverthrow";
import {
	fromUnknownThrow,
	VoidhashForbiddenError,
	VoidhashInternalServerError,
	VoidhashNotFoundError,
	VoidhashUnauthorizedError,
} from "@voidhash/lib/constants";
import { Organization } from "@voidhash/db";
import { isAuthenticated } from "@/lib/middlewares";

export const getOrganizationBySlugInputSchema = z.object({
	slug: z.string(),
});

type GetOrganizationBySlugError =
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError
	| VoidhashNotFoundError
	| VoidhashInternalServerError;

export const getOrganizationBySlug = cache(
	createServiceFunction()
		.input(getOrganizationBySlugInputSchema)
		.use(isAuthenticated)
		.function(
			async ({
				ctx,
				input,
			}): Promise<Result<Organization, GetOrganizationBySlugError>> => {
				const organization = await getOrganizationBySlugQuery(ctx, input.slug);

				if (organization.isErr()) {
					return err(organization.error);
				}

				if (
					!hasOrganizationPermission(
						ctx,
						organization.value.id,
						"organization:all"
					)
				) {
					console.log(ctx.session);
					return err({
						code: "FORBIDDEN",
						message: "You are not authorized to access this organization",
					});
				}

				return ok(organization.value);
			}
		).invoke
);

export const getOrganizationByIdInputSchema = z.object({
	id: z.string(),
});

type GetOrganizationByIdError =
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError
	| VoidhashNotFoundError
	| VoidhashInternalServerError;

export const getOrganizationById = cache(
	createServiceFunction()
		.input(getOrganizationByIdInputSchema)
		.use(isAuthenticated)
		.function(
			async ({
				ctx,
				input,
			}): Promise<Result<Organization, GetOrganizationByIdError>> => {
				// const organization = await ctx.cache.cacheFn(
				// 	async (id: string) => {
				// 		return getOrganizationByIdQuery(authenticatedContext.value, id);
				// 	},
				// 	["organization", input.id],
				// 	{
				// 		tags: [`organization_${input.id}`],
				// 		revalidate: 3600,
				// 	}
				// )(input.id);

				const organization = await getOrganizationByIdQuery(ctx, input.id);

				if (organization.isErr()) {
					return err(organization.error);
				}

				if (
					!hasOrganizationPermission(
						ctx,
						organization.value.id,
						"organization:all"
					)
				) {
					return err({
						code: "FORBIDDEN",
						message: "You are not authorized to access this organization",
					});
				}

				return ok(organization.value);
			}
		).invoke
);

type GetUsersOrganizationsError =
	| VoidhashUnauthorizedError
	| VoidhashInternalServerError;

export const getUsersOrganizations = cache(
	createServiceFunction()
		.use(isAuthenticated)
		.function(
			async ({
				ctx,
			}): Promise<Result<Organization[], GetUsersOrganizationsError>> => {
				const organizations = await ResultAsync.fromPromise(
					auth.api.listOrganizations({
						headers: ctx.headers,
					}),
					(e) => fromUnknownThrow(e)
				);

				if (organizations.isErr()) {
					return err(organizations.error);
				}

				return ok(
					organizations.value.map((o) => ({
						id: o.id,
						name: o.name,
						slug: o.slug,
						logo: o.logo ?? null,
						createdAt: o.createdAt,
						metadata: o.metadata ?? null,
					}))
				);
			}
		).invoke
);
