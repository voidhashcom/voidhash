import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { z } from "zod";
import { getProjectById } from "../queries";
import {
	fromUnknownThrow,
	VoidhashBadRequestError,
	VoidhashError,
	VoidhashForbiddenError,
	VoidhashInternalServerError,
	VoidhashNotFoundError,
	VoidhashUnauthorizedError,
} from "@voidhash/lib";
import { projects } from "@voidhash/db";
import { eq } from "drizzle-orm";
import { getOrganizationById } from "../../organizations/queries";
import { err, ok, Result } from "neverthrow";

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
	.function(
		async ({ input, ctx }): Promise<Result<void, DeleteProjectError>> => {
			const authenticatedContext = await authenticateContext(ctx);
			if (authenticatedContext.isErr()) {
				return err(authenticatedContext.error);
			}

			if (
				!hasProjectPermission(
					authenticatedContext.value,
					input.id,
					"project:all"
				)
			) {
				return err({
					code: "FORBIDDEN",
					message: "You are not authorized to delete this project",
				});
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

			const organization = await getOrganizationById({
				ctx: authenticatedContext.value,
				input: {
					id: project.value.organizationId,
				},
			});

			if (organization.isErr()) {
				return err(organization.error);
			}

			if (!organization.value) {
				return err({
					code: "NOT_FOUND",
					message: "Organization not found",
					resource: "organization",
					payload: {
						id: project.value.organizationId,
					},
				});
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
