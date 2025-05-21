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
import {
	VoidhashUnauthorizedError,
	VoidhashInternalServerError,
	VoidhashBadRequestError,
	VoidhashForbiddenError,
	VoidhashNotFoundError,
} from "@voidhash/lib/constants";
import { err, ok, Result } from "neverthrow";
import { Project } from "@voidhash/db";

type GetProjectBySlugError =
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError
	| VoidhashNotFoundError
	| VoidhashInternalServerError;

export const getProjectBySlug = cache(
	createServiceFunction()
		.input(
			z.object({
				organizationId: z.string(),
				slug: z.string(),
			})
		)
		.function(
			async ({
				input,
				ctx,
			}): Promise<Result<Project, GetProjectBySlugError>> => {
				const authenticatedContext = await authenticateContext(ctx);

				if (authenticatedContext.isErr()) {
					return err(authenticatedContext.error);
				}

				const project = await ctx.cache.cacheFn(
					async (organizationId: string, projectSlug: string) => {
						return getProjectBySlugQuery(
							authenticatedContext.value,
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

				if (project.isErr()) {
					return err(project.error);
				}

				if (
					!hasProjectPermission(
						authenticatedContext.value,
						project.value.id,
						"project:all"
					)
				) {
					return err({
						code: "FORBIDDEN",
						message: "You are not authorized to access this project",
					});
				}

				return ok(project.value);
			}
		).invoke
);

type GetProjectBySlugAndOrganizationSlugError =
	| VoidhashUnauthorizedError
	| VoidhashInternalServerError
	| VoidhashForbiddenError
	| VoidhashNotFoundError
	| VoidhashBadRequestError;

export const getProjectBySlugAndOrganizationSlug = cache(
	createServiceFunction()
		.input(
			z.object({
				organizationSlug: z.string(),
				projectSlug: z.string(),
			})
		)
		.function(
			async ({
				input,
				ctx,
			}): Promise<
				Result<Project, GetProjectBySlugAndOrganizationSlugError>
			> => {
				const authenticatedContext = await authenticateContext(ctx);

				if (authenticatedContext.isErr()) {
					return err(authenticatedContext.error);
				}

				const organization = await getOrganizationBySlug({
					ctx: authenticatedContext.value,
					input: {
						slug: input.organizationSlug,
					},
				});

				if (organization.isErr()) {
					return err(organization.error);
				}

				const project = await getProjectBySlug({
					ctx: authenticatedContext.value,
					input: {
						organizationId: organization.value.id,
						slug: input.projectSlug,
					},
				});

				if (project.isErr()) {
					return err(project.error);
				}

				if (
					!hasProjectPermission(
						authenticatedContext.value,
						project.value.id,
						"project:all"
					)
				) {
					return err({
						code: "FORBIDDEN",
						message: "You are not authorized to access this project",
					});
				}

				return ok(project.value);
			}
		).invoke
);

type GetProjectByIdError =
	| VoidhashUnauthorizedError
	| VoidhashInternalServerError
	| VoidhashForbiddenError
	| VoidhashNotFoundError;

export const getProjectById = cache(
	createServiceFunction()
		.input(
			z.object({
				id: z.string(),
			})
		)
		.function(
			async ({ input, ctx }): Promise<Result<Project, GetProjectByIdError>> => {
				const authenticatedContext = await authenticateContext(ctx);

				if (authenticatedContext.isErr()) {
					return err(authenticatedContext.error);
				}

				const project = await ctx.cache.cacheFn(
					async (id: string) => {
						return getProjectByIdQuery(authenticatedContext.value, id);
					},
					["project", input.id],
					{
						tags: [`project_${input.id}`],
						revalidate: 3600,
					}
				)(input.id);

				if (project.isErr()) {
					return err(project.error);
				}

				if (
					!hasProjectPermission(
						authenticatedContext.value,
						project.value.id,
						"project:all"
					)
				) {
					return err({
						code: "FORBIDDEN",
						message: "You are not authorized to access this project",
					});
				}

				return ok(project.value);
			}
		).invoke
);

type GetProjectsByOrganizationSlugError =
	| VoidhashUnauthorizedError
	| VoidhashInternalServerError
	| VoidhashForbiddenError
	| VoidhashNotFoundError
	| VoidhashBadRequestError;

export const getProjectsByOrganizationSlug = cache(
	createServiceFunction()
		.input(
			z.object({
				slug: z.string(),
			})
		)
		.function(
			async ({
				input,
				ctx,
			}): Promise<Result<Project[], GetProjectsByOrganizationSlugError>> => {
				const authenticatedContext = await authenticateContext(ctx);

				if (authenticatedContext.isErr()) {
					return err(authenticatedContext.error);
				}

				const organization = await getOrganizationBySlug({
					ctx: authenticatedContext.value,
					input: {
						slug: input.slug,
					},
				});

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
						resource: "organization",
						payload: {
							id: organization.value.id,
						},
					});
				}

				return await ctx.cache.cacheFn(
					async (orgId: string) => {
						return getProjectsByIdQuery(authenticatedContext.value, orgId);
					},
					["projects", organization.value.id],
					{
						tags: [`projects_${organization.value.id}`],
						revalidate: 3600,
					}
				)(organization.value.id);
			}
		).invoke
);
