import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { cache } from "react";
import { z } from "zod";
import { getCustomersQuery } from "./raw-queries";

export const getCustomers = cache(
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

			const customers = await getCustomersQuery(input.projectId);
			return customers;
		})
);
