import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { VoidhashError } from "@voidhash/lib";
import { z } from "zod";
import { customers, InsertCustomer } from "@voidhash/db";
import { generateId } from "@/lib/id/generate";

export const createCustomerInputSchema = z.object({
	projectId: z.string(),
	appUserId: z.string().optional(),
	name: z.string().optional(),
	email: z.string().email().optional(),
	origin: z.enum(["dashboard", "ios", "android", "stripe", "api"]),
});

export const createCustomer = createServiceFunction()
	.input(createCustomerInputSchema)
	.function(async ({ input, ctx }) => {
		const authenticatedContext = await authenticateContext(ctx);
		if (!hasProjectPermission(authenticatedContext, input.projectId, "")) {
			throw new VoidhashError({
				code: "FORBIDDEN",
				message: "You are not authorized to create customers",
			});
		}

		const newCustomer: InsertCustomer = {
			id: generateId("customer"),
			projectId: input.projectId,
			appUserId: input.appUserId,
			name: input.name,
			email: input.email,
			origin: input.origin,
		};

		await ctx.db.insert(customers).values(newCustomer);

		return newCustomer;
	});
