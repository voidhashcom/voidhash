import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { createId, UnauthorizedError } from "@voidhash/lib";
import { z } from "zod";
import { db, customer } from "@voidhash/db";

export const createCustomerInputSchema = z.object({
	projectId: z.string(),
	name: z.string().optional(),
	email: z.string().email(),
});

export const createCustomer = createServiceFunction()
	.input(createCustomerInputSchema)
	.function(async ({ input, ctx }) => {
		const authenticatedContext = await authenticateContext(ctx);
		if (!hasProjectPermission(authenticatedContext, input.projectId, "")) {
			throw new UnauthorizedError("You are not authorized to create customers");
		}

		const newCustomer = {
			id: createId(),
			projectId: input.projectId,
			name: input.name,
			email: input.email,
		};

		await db.insert(customer).values(newCustomer);

		return newCustomer;
	});
