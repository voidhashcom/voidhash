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
import { err, ok, Result, ResultAsync } from "neverthrow";
import {
	fromUnknownThrow,
	VoidhashForbiddenError,
	VoidhashInternalServerError,
	VoidhashNotFoundError,
	VoidhashUnauthorizedError,
} from "@voidhash/lib/constants";
import { Organization } from "@voidhash/db";

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
		.function(
			async ({
				ctx,
				input,
			}): Promise<Result<Organization, GetOrganizationBySlugError>> => {
				const authenticatedContext = await authenticateContext(ctx);

				if (authenticatedContext.isErr()) {
					return err(authenticatedContext.error);
				}

				const organization = await ctx.cache.cacheFn(
					async (s: string) => {
						return getOrganizationBySlugQuery(authenticatedContext.value, s);
					},
					["organization", input.slug],
					{
						tags: [`organization_slug:${input.slug}`],
						revalidate: 3600,
					}
				)(input.slug);

				if (organization.isErr()) {
					return err(organization.error);
				}

				if (
					!hasOrganizationPermission(
						authenticatedContext.value,
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
		.function(
			async ({
				ctx,
				input,
			}): Promise<Result<Organization, GetOrganizationByIdError>> => {
				const authenticatedContext = await authenticateContext(ctx);

				if (authenticatedContext.isErr()) {
					return err(authenticatedContext.error);
				}

				const organization = await ctx.cache.cacheFn(
					async (id: string) => {
						return getOrganizationByIdQuery(authenticatedContext.value, id);
					},
					["organization", input.id],
					{
						tags: [`organization_${input.id}`],
						revalidate: 3600,
					}
				)(input.id);

				if (organization.isErr()) {
					return err(organization.error);
				}

				if (
					!hasOrganizationPermission(
						authenticatedContext.value,
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
	createServiceFunction().function(
		async ({
			ctx,
		}): Promise<Result<Organization[], GetUsersOrganizationsError>> => {
			const authenticatedContext = await authenticateContext(ctx);

			if (authenticatedContext.isErr()) {
				return err(authenticatedContext.error);
			}

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
