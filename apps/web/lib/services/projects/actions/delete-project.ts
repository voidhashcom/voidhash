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
import { getOrganizationByIdQuery } from "../../organizations/raw-queries";
import { isAuthenticated } from "@/lib/middlewares";

export const deleteProjectInputSchema = z.object({
	id: z.string(),
});

type DeleteProjectError =
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError
	| VoidhashInternalServerError
	| VoidhashNotFoundError
	| VoidhashBadRequestError;

export const deleteProject = createServiceFunction()
	.input(deleteProjectInputSchema)
	.use(isAuthenticated)
	.function(
		async ({ input, ctx }): Promise<Result<void, DeleteProjectError>> => {
			if (!hasProjectPermission(ctx, input.id, "project:all")) {
				return err({
					code: "FORBIDDEN",
					message: "You are not authorized to delete this project",
				});
			}

			const project = await getProjectByIdQuery(ctx, input.id);

			if (project.isErr()) {
				return err(project.error);
			}

			const organization = await getOrganizationByIdQuery(
				ctx,
				project.value.organizationId
			);

			if (organization.isErr()) {
				return err(organization.error);
			}

			try {
				await ctx.db.delete(projects).where(eq(projects.id, input.id));

				ctx.cache.invalidate(`project_${project.value.id}`);
				ctx.cache.invalidate(
					`project_${organization.value.id}_slug:${project.value.slug}`
				);
				ctx.cache.invalidate(`projects_${project.value.organizationId}`);

				return ok(undefined);
			} catch (e) {
				return err(fromUnknownThrow(e));
			}
		}
	);
