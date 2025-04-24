import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { cache } from "react";
import { z } from "zod";
import { getCustomerByAppUserIdQuery, getCustomersQuery } from "./raw-queries";

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

export const getCustomerByAppUserId = cache(
	createServiceFunction()
		.input(z.object({ appUserId: z.string() }))
		.function(async ({ ctx, input }) => {
			const authenticatedContext = await authenticateContext(ctx);
			const customer = await getCustomerByAppUserIdQuery(input.appUserId);
			if (!customer) {
				return null;
			}
			if (!hasProjectPermission(authenticatedContext, customer.projectId, "")) {
				return null;
			}
			return customer;
		})
);
