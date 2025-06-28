// import {
// 	createServiceFunction,
// 	hasOrganizationPermission,
// 	hasProjectPermission,
// } from "@/lib/service-function";
// import { z } from "zod";
// import {
// 	getProjectByIdQuery,
// 	getProjectBySlugQuery,
// 	getProjectsByIdQuery,
// } from "./raw-queries";
// import { cache } from "react";
// import {
// 	VoidhashUnauthorizedError,
// 	VoidhashInternalServerError,
// 	VoidhashBadRequestError,
// 	VoidhashForbiddenError,
// 	VoidhashNotFoundError,
// } from "@voidhash/lib/constants";
// import { err, ok, Result } from "neverthrow";
// import { Project } from "@voidhash/db";
// import { isAuthenticated } from "@/lib/middlewares";

// type GetProjectBySlugError =
// 	| VoidhashUnauthorizedError
// 	| VoidhashForbiddenError
// 	| VoidhashNotFoundError
// 	| VoidhashInternalServerError;

// export const getProjectBySlug = cache(
// 	createServiceFunction()
// 		.input(
// 			z.object({
// 				organizationId: z.string(),
// 				slug: z.string(),
// 			})
// 		)
// 		.use(isAuthenticated)
// 		.function(
// 			async ({
// 				input,
// 				ctx,
// 			}): Promise<Result<Project, GetProjectBySlugError>> => {
// 				// const project = await ctx.cache.cacheFn(
// 				// 	async (organizationId: string, projectSlug: string) => {
// 				// 		return getProjectBySlugQuery(
// 				// 			authenticatedContext.value,
// 				// 			organizationId,
// 				// 			projectSlug
// 				// 		);
// 				// 	},
// 				// 	["project", input.organizationId, input.slug],
// 				// 	{
// 				// 		tags: [`project_${input.organizationId}_slug:${input.slug}`],
// 				// 		revalidate: 3600,
// 				// 	}
// 				// )(input.organizationId, input.slug);

// 				const project = await getProjectBySlugQuery(
// 					ctx,
// 					input.organizationId,
// 					input.slug
// 				);

// 				if (project.isErr()) {
// 					return err(project.error);
// 				}

// 				if (!hasProjectPermission(ctx, project.value.id, "project:all")) {
// 					return err({
// 						code: "FORBIDDEN",
// 						message: "You are not authorized to access this project",
// 					});
// 				}

// 				return ok(project.value);
// 			}
// 		).invoke
// );

// type GetProjectBySlugAndOrganizationSlugError =
// 	| VoidhashUnauthorizedError
// 	| VoidhashInternalServerError
// 	| VoidhashForbiddenError
// 	| VoidhashNotFoundError
// 	| VoidhashBadRequestError;

// export const getProjectBySlugAndOrganizationSlug = cache(
// 	createServiceFunction()
// 		.input(
// 			z.object({
// 				organizationSlug: z.string(),
// 				projectSlug: z.string(),
// 			})
// 		)
// 		.use(isAuthenticated)
// 		.function(
// 			async ({
// 				input,
// 				ctx,
// 			}): Promise<
// 				Result<Project, GetProjectBySlugAndOrganizationSlugError>
// 			> => {
// 				const organization = await getOrganizationBySlugQuery(
// 					ctx,
// 					input.organizationSlug
// 				);

// 				if (organization.isErr()) {
// 					return err(organization.error);
// 				}

// 				const project = await getProjectBySlugQuery(
// 					ctx,
// 					organization.value.id,
// 					input.projectSlug
// 				);

// 				if (project.isErr()) {
// 					return err(project.error);
// 				}

// 				if (!hasProjectPermission(ctx, project.value.id, "project:all")) {
// 					return err({
// 						code: "FORBIDDEN",
// 						message: "You are not authorized to access this project",
// 					});
// 				}

// 				return ok(project.value);
// 			}
// 		).invoke
// );

// type GetProjectByIdError =
// 	| VoidhashUnauthorizedError
// 	| VoidhashInternalServerError
// 	| VoidhashForbiddenError
// 	| VoidhashNotFoundError;

// export type GetProjectByIdSuccess = Project;

// export const getProjectById = cache(
// 	createServiceFunction()
// 		.input(
// 			z.object({
// 				id: z.string(),
// 			})
// 		)
// 		.use(isAuthenticated)
// 		.function(
// 			async ({ input, ctx }): Promise<Result<Project, GetProjectByIdError>> => {
// 				// const project = await ctx.cache.cacheFn(
// 				// 	async (id: string) => {
// 				// 		return getProjectByIdQuery(authenticatedContext.value, id);
// 				// 	},
// 				// 	["project", input.id],
// 				// 	{
// 				// 		tags: [`project_${input.id}`],
// 				// 		revalidate: 3600,
// 				// 	}
// 				// )(input.id);

// 				const project = await getProjectByIdQuery(ctx, input.id);

// 				if (project.isErr()) {
// 					return err(project.error);
// 				}

// 				if (!hasProjectPermission(ctx, project.value.id, "project:all")) {
// 					return err({
// 						code: "FORBIDDEN",
// 						message: "You are not authorized to access this project",
// 					});
// 				}

// 				return ok(project.value);
// 			}
// 		).invoke
// );

// type GetProjectsByOrganizationSlugError =
// 	| VoidhashUnauthorizedError
// 	| VoidhashInternalServerError
// 	| VoidhashForbiddenError
// 	| VoidhashNotFoundError
// 	| VoidhashBadRequestError;

// export const getProjectsByOrganizationSlug = cache(
// 	createServiceFunction()
// 		.input(
// 			z.object({
// 				slug: z.string(),
// 			})
// 		)
// 		.use(isAuthenticated)
// 		.function(
// 			async ({
// 				input,
// 				ctx,
// 			}): Promise<Result<Project[], GetProjectsByOrganizationSlugError>> => {
// 				const organization = await getOrganizationBySlugQuery(ctx, input.slug);

// 				if (organization.isErr()) {
// 					return err(organization.error);
// 				}

// 				if (
// 					!hasOrganizationPermission(
// 						ctx,
// 						organization.value.id,
// 						"organization:all"
// 					)
// 				) {
// 					return err({
// 						code: "FORBIDDEN",
// 						message: "You are not authorized to access this organization",
// 						resource: "organization",
// 						payload: {
// 							id: organization.value.id,
// 						},
// 					});
// 				}

// 				return await getProjectsByIdQuery(ctx, organization.value.id);
// 				// return await ctx.cache.cacheFn(
// 				// 	async (orgId: string) => {
// 				// 		return
// 				// 	},
// 				// 	["projects", organization.value.id],
// 				// 	{
// 				// 		tags: [`projects_${organization.value.id}`],
// 				// 		revalidate: 3600,
// 				// 	}
// 				// )(organization.value.id);
// 			}
// 		).invoke
// );
