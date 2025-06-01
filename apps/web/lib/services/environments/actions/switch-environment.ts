import {
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import {
	VoidhashForbiddenError,
	VoidhashInternalServerError,
	VoidhashNotFoundError,
	VoidhashUnauthorizedError,
} from "@voidhash/lib";
import { z } from "zod";
import { Environments } from "@/lib/services/environments/types";
import { setEnvironment } from "@/lib/services/environments/utils";
import { err, ok, Result } from "neverthrow";
import { getOrganizationByIdQuery } from "../../organizations/raw-queries";
import { getProjectByIdQuery } from "../../projects/raw-queries";
import { isAuthenticated } from "@/lib/middlewares";

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
	.use(isAuthenticated)
	.function(
		async ({ input, ctx }): Promise<Result<void, SwitchEnvironmentError>> => {
			if (!hasProjectPermission(ctx, input.projectId, "project:all")) {
				return err({
					code: "FORBIDDEN",
					message: "You are not authorized to switch environment",
				});
			}

			const project = await getProjectByIdQuery(ctx, input.projectId);

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
