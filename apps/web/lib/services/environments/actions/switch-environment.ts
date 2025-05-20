import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import {
	VoidhashError,
	VoidhashForbiddenError,
	VoidhashInternalServerError,
	VoidhashNotFoundError,
	VoidhashUnauthorizedError,
} from "@voidhash/lib";
import { z } from "zod";
import { Environments } from "@/lib/services/environments/types";
import { setEnvironment } from "@/lib/services/environments/utils";
import { getOrganizationById } from "@/lib/services/organizations/queries";
import { getProjectById } from "@/lib/services/projects/queries";
import { err, ok, Result } from "neverthrow";

export const switchEnvironmentInputSchema = z.object({
	projectId: z.string(),
	environment: z.nativeEnum(Environments),
});

type SwitchEnvironmentError =
	| VoidhashUnauthorizedError
	| VoidhashInternalServerError
	| VoidhashForbiddenError
	| VoidhashNotFoundError;

export const switchEnvironment = createServiceFunction()
	.input(switchEnvironmentInputSchema)
	.function(
		async ({ input, ctx }): Promise<Result<void, SwitchEnvironmentError>> => {
			const authenticatedContext = await authenticateContext(ctx);

			if (authenticatedContext.isErr()) {
				return err(authenticatedContext.error);
			}

			if (
				!hasProjectPermission(
					authenticatedContext.value,
					input.projectId,
					"project:all"
				)
			) {
				return err({
					code: "FORBIDDEN",
					message: "You are not authorized to switch environment",
				});
			}

			const project = await getProjectById({
				ctx: authenticatedContext.value,
				input: { id: input.projectId },
			});

			if (project.isErr()) {
				return err(project.error);
			}

			if (!project.value) {
				return err({
					code: "NOT_FOUND",
					message: "Project not found",
					resource: "project",
					payload: { id: input.projectId },
				});
			}

			const organization = await getOrganizationById({
				ctx: authenticatedContext.value,
				input: { id: project.value.organizationId },
			});
			if (organization.isErr()) {
				return err(organization.error);
			}

			if (!organization.value) {
				return err({
					code: "NOT_FOUND",
					message: "Organization not found",
					resource: "organization",
					payload: { id: project.value.organizationId },
				});
			}

			if (!organization.value.slug) {
				return err({
					code: "INTERNAL_SERVER_ERROR",
					message: "Organization slug not found - " + organization.value.id,
					originalError: new Error(
						"Organization slug not found - " + organization.value.id
					),
				});
			}

			await setEnvironment(
				ctx.cookies,
				organization.value.slug,
				project.value.slug,
				input.environment
			);

			return ok(undefined);
		}
	);
