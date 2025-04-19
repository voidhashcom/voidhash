import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { cache } from "react";
import { getPaymentProviderConfigurationsQuery } from "./raw-queries";
import { z } from "zod";

export const getPaymentProviderConfigurations = cache(
	createServiceFunction()
		.input(
			z.object({
				projectId: z.string(),
			})
		)
		.function(async ({ ctx, input }) => {
			const authenticatedContext = await authenticateContext(ctx);
			if (!hasProjectPermission(authenticatedContext, input.projectId, "")) {
				return [];
			}
			return await getPaymentProviderConfigurationsQuery(input.projectId);
		})
);
