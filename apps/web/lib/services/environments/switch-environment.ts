import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { VoidhashError } from "@voidhash/lib";
import { z } from "zod";
import { Environments } from "@/lib/services/environments/types";
import { setEnvironment } from "@/lib/services/environments/utils";
import { getOrganizationById } from "../organizations/queries";
import { getProjectById } from "../projects/queries";

export const switchEnvironmentInputSchema = z.object({
	projectId: z.string(),
	environment: z.nativeEnum(Environments),
});

export const switchEnvironment = createServiceFunction()
	.input(switchEnvironmentInputSchema)
	.function(async ({ input, ctx }) => {
		const authenticatedContext = await authenticateContext(ctx);

		if (!hasProjectPermission(authenticatedContext, input.projectId, "")) {
			throw new VoidhashError({
				code: "UNAUTHORIZED",
				message: "You are not authorized to switch environment",
			});
		}

		const project = await getProjectById({
			ctx: authenticatedContext,
			input: { id: input.projectId },
		});
		if (!project) {
			throw new VoidhashError({
				code: "NOT_FOUND",
				message: "Project not found",
			});
		}

		const organization = await getOrganizationById({
			ctx,
			input: { id: project.organizationId },
		});
		if (!organization) {
			throw new VoidhashError({
				code: "NOT_FOUND",
				message: "Organization not found",
			});
		}

		if (!organization.slug) {
			throw new Error("Organization slug not found - " + organization.id);
		}

		await setEnvironment(
			ctx.cookies,
			organization.slug,
			project.slug,
			input.environment
		);

		return { success: true };
	});
