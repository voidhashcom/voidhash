import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { z } from "zod";
import { getProjectById } from "@/lib/services/projects/queries";
import {
	fromUnknownThrow,
	VoidhashBadRequestError,
	VoidhashForbiddenError,
	VoidhashInternalServerError,
	VoidhashNotFoundError,
	VoidhashUnauthorizedError,
} from "@voidhash/lib";
import { projects } from "@voidhash/db";
import { eq } from "drizzle-orm";
import { err, ok, Result } from "neverthrow";

export const updateProjectInputSchema = z.object({
	id: z.string(),
	name: z.string().min(1).max(32),
});

type UpdateProjectError =
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError
	| VoidhashInternalServerError
	| VoidhashNotFoundError
	| VoidhashBadRequestError;

export const updateProject = createServiceFunction()
	.input(updateProjectInputSchema)
	.function(
		async ({ input, ctx }): Promise<Result<void, UpdateProjectError>> => {
			const authenticatedContext = await authenticateContext(ctx);
			if (authenticatedContext.isErr()) {
				return err(authenticatedContext.error);
			}

			const project = await getProjectById({
				ctx: authenticatedContext.value,
				input: {
					id: input.id,
				},
			});
			if (project.isErr()) {
				return err(project.error);
			}

			if (!project.value) {
				return err({
					code: "NOT_FOUND",
					message: "Project not found",
					resource: "project",
					payload: {
						id: input.id,
					},
				});
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
					message: "You are not authorized to update this project",
				});
			}

			try {
				await ctx.db
					.update(projects)
					.set({
						name: input.name,
					})
					.where(eq(projects.id, input.id));

				ctx.cache.invalidate(`project_${project.value.id}`);
				ctx.cache.invalidate(
					`project_${project.value.organizationId}_slug:${project.value.slug}`
				);
				ctx.cache.invalidate(`projects_${project.value.organizationId}`);

				return ok(undefined);
			} catch (e) {
				return err(fromUnknownThrow(e));
			}
		}
	);
