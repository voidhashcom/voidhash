import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { cache } from "react";
import { z } from "zod";
import {
	getCustomerByAppUserIdQuery,
	getCustomerByIdQuery,
	getCustomersQuery,
	getCustomersUnlockedPerksQuery,
} from "./raw-queries";

export const getCustomers = cache(
	createServiceFunction()
		.input(
			z.object({
				projectId: z.string(),
				hasAppUserId: z.boolean().optional(),
			})
		)
		.function(async ({ ctx, input }) => {
			const authenticatedContext = await authenticateContext(ctx);

			if (!hasProjectPermission(authenticatedContext, input.projectId, "")) {
				return [];
			}

			const customers = await getCustomersQuery(
				authenticatedContext,
				input.projectId,
				{
					hasAppUserId: input.hasAppUserId ?? null,
				}
			);
			return customers;
		}).invoke
);

export const getCustomerById = cache(
	createServiceFunction()
		.input(z.object({ id: z.string() }))
		.function(async ({ ctx, input }) => {
			const authenticatedContext = await authenticateContext(ctx);
			const customer = await getCustomerByIdQuery(
				authenticatedContext,
				input.id
			);
			return customer;
		}).invoke
);

export const getCustomerByAppUserId = cache(
	createServiceFunction()
		.input(z.object({ appUserId: z.string() }))
		.function(async ({ ctx, input }) => {
			const authenticatedContext = await authenticateContext(ctx);
			const customer = await getCustomerByAppUserIdQuery(
				authenticatedContext,
				input.appUserId
			);
			if (!customer) {
				return null;
			}
			if (!hasProjectPermission(authenticatedContext, customer.projectId, "")) {
				return null;
			}
			return customer;
		}).invoke
);

export const getCustomersUnlockedPerks = cache(
	createServiceFunction()
		.input(z.object({ customerId: z.string() }))
		.function(async ({ ctx, input }) => {
			const authenticatedContext = await authenticateContext(ctx);
			const customer = await getCustomersUnlockedPerksQuery(
				authenticatedContext,
				input.customerId
			);
			return customer;
		}).invoke
);
