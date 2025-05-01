import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { VoidhashError } from "@voidhash/lib";
import { z } from "zod";
import { paywallLocations } from "@voidhash/db";
import { getPaywallLocationByIdQuery } from "./raw-queries";
import { eq } from "drizzle-orm";

export const deletePaywallLocationInputSchema = z.object({
	paywallLocationId: z.string(),
});

export const deletePaywallLocation = createServiceFunction()
	.input(deletePaywallLocationInputSchema)
	.function(async ({ input, ctx }) => {
		const authenticatedContext = await authenticateContext(ctx);
		const existingPaywallLocation = await getPaywallLocationByIdQuery(
			authenticatedContext,
			input.paywallLocationId
		);
		if (!existingPaywallLocation) {
			throw new VoidhashError({
				code: "NOT_FOUND",
				message: "Paywall location not found",
			});
		}

		if (
			!hasProjectPermission(
				authenticatedContext,
				existingPaywallLocation.projectId,
				""
			)
		) {
			throw new VoidhashError({
				code: "FORBIDDEN",
				message: "You are not authorized to delete this paywall location",
			});
		}

		await ctx.db
			.delete(paywallLocations)
			.where(eq(paywallLocations.id, input.paywallLocationId));
	});
