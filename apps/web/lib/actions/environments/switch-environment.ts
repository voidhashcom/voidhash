"use server";

import { NotFoundError } from "@voidhash/lib";
import { authActionClient } from "@/features/lib/safe-action";
import { Environments } from "@/lib/environments/types";
import {
	getOrganizationById,
	getProjectById,
} from "@/lib/queries/cached-queries";
import { z } from "zod";
import { setEnvironment } from "@/lib/environments/utils";

const switchEnvironmentSchema = z.object({
	projectId: z.string(),
	environment: z.nativeEnum(Environments),
});

export const switchEnvironment = authActionClient
	.schema(switchEnvironmentSchema)
	.action(async ({ parsedInput }) => {
		const project = await getProjectById(parsedInput.projectId);
		if (!project) {
			throw new NotFoundError("Project not found");
		}
		const organization = await getOrganizationById(project.organizationId);
		if (!organization) {
			throw new NotFoundError("Organization not found");
		}

		if (!organization.slug) {
			throw new Error("Organization slug not found - " + organization.id);
		}

		await setEnvironment(
			organization.slug,
			project.slug,
			parsedInput.environment
		);
	});
