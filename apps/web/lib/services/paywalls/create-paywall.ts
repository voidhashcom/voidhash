import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { createId, UnauthorizedError } from "@voidhash/lib";
import { z } from "zod";
import { paywall } from "@voidhash/db";

export const createPaywallInputSchema = z.object({
	projectId: z.string(),
	name: z
		.string()
		.min(3, "Name must be at least 3 characters long")
		.max(32, "Name must be less than 32 characters"),
});

export const createPaywall = createServiceFunction()
	.input(createPaywallInputSchema)
	.function(async ({ input, ctx }) => {
		const authenticatedContext = await authenticateContext(ctx);
		if (!hasProjectPermission(authenticatedContext, input.projectId, "")) {
			throw new UnauthorizedError("You are not authorized to create paywalls");
		}

		const newPaywall = {
			id: createId(),
			projectId: input.projectId,
			name: input.name,
		};
		await ctx.db.insert(paywall).values(newPaywall);

		return newPaywall;
	});
