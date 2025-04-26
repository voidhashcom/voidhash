import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { createId, VoidhashError } from "@voidhash/lib";
import { z } from "zod";
import { customer } from "@voidhash/db";

export const createCustomerInputSchema = z.object({
	projectId: z.string(),
	appUserId: z.string().optional(),
	name: z.string().optional(),
	email: z.string().email(),
});

export const createCustomer = createServiceFunction()
	.input(createCustomerInputSchema)
	.function(async ({ input, ctx }) => {
		const authenticatedContext = await authenticateContext(ctx);
		if (!hasProjectPermission(authenticatedContext, input.projectId, "")) {
			throw new VoidhashError({
				code: "UNAUTHORIZED",
				message: "You are not authorized to create customers",
			});
		}

		const newCustomer = {
			id: createId(),
			projectId: input.projectId,
			appUserId: input.appUserId,
			name: input.name,
			email: input.email,
		};

		await ctx.db.insert(customer).values(newCustomer);

		return newCustomer;
	});
