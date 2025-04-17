import { createServiceFunction } from "@/lib/service-function";
import { cache } from "react";
import { getPaymentProviderConfigurationsQuery } from "./raw-queries";
import { z } from "zod";
import { getProjectById } from "../projects/queries";
import { NotFoundError } from "@voidhash/lib/constants";

export const getPaymentProviderConfigurations = cache(
	createServiceFunction()
		.input(
			z.object({
				projectId: z.string(),
			})
		)
		.function(async ({ ctx, input }) => {
			const project = await getProjectById({
				ctx,
				input: { id: input.projectId },
			});
			if (!project) {
				throw new NotFoundError("Project not found");
			}
			return await getPaymentProviderConfigurationsQuery(input.projectId);
		})
);
