import { createServiceFunction } from "@/lib/service-function";
import { NotFoundError } from "@voidhash/lib";
import { z } from "zod";
import { Environments } from "@/lib/environments/types";
import { setEnvironment } from "@/lib/environments/utils";
import { getOrganizationById } from "../organizations/queries";
import { getProjectById } from "../projects/queries";

export const switchEnvironmentInputSchema = z.object({
	projectId: z.string(),
	environment: z.nativeEnum(Environments),
});

export const switchEnvironment = createServiceFunction()
	.input(switchEnvironmentInputSchema)
	.function(async ({ input, ctx }) => {
		const project = await getProjectById({
			ctx,
			input: { id: input.projectId },
		});
		if (!project) {
			throw new NotFoundError("Project not found");
		}

		const organization = await getOrganizationById({
			ctx,
			input: { id: project.organizationId },
		});
		if (!organization) {
			throw new NotFoundError("Organization not found");
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
