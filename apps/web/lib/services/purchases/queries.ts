import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { cache } from "react";
import { z } from "zod";
import { getPurchasesQuery } from "./raw-queries";

export const getPurchasesInputSchema = z.object({
	projectId: z.string(),
	customerId: z.string().optional(),
});

export const getPurchases = cache(
	createServiceFunction()
		.input(getPurchasesInputSchema)
		.function(async ({ input, ctx }) => {
			const authenticatedContext = await authenticateContext(ctx);
			if (!hasProjectPermission(authenticatedContext, input.projectId, "")) {
				return {
					purchases: [],
					total: 0,
				};
			}

			return await getPurchasesQuery(authenticatedContext, input.customerId);
		}).invoke
);
