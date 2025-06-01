import {
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { z } from "zod";
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
import { getProjectByIdQuery } from "../raw-queries";
import { isAuthenticated } from "@/lib/middlewares";

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
	.use(isAuthenticated)
	.function(
		async ({ input, ctx }): Promise<Result<void, UpdateProjectError>> => {
			const project = await getProjectByIdQuery(ctx, input.id);
			if (project.isErr()) {
				return err(project.error);
			}

			if (!hasProjectPermission(ctx, project.value.id, "project:all")) {
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
