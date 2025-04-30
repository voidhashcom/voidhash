import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { VoidhashError } from "@voidhash/lib";
import { z } from "zod";
import { paywalls } from "@voidhash/db";
import { getPaywallById } from "./queries";
import { eq } from "drizzle-orm";

export const deletePaywallInputSchema = z.object({
	paywallId: z.string(),
});

export const deletePaywall = createServiceFunction()
	.input(deletePaywallInputSchema)
	.function(async ({ input, ctx }) => {
		const authenticatedContext = await authenticateContext(ctx);
		const existingPaywall = await getPaywallById({
			ctx: authenticatedContext,
			input: { id: input.paywallId },
		});
		if (!existingPaywall) {
			throw new VoidhashError({
				code: "NOT_FOUND",
				message: "Paywall not found",
			});
		}

		if (
			!hasProjectPermission(authenticatedContext, existingPaywall.projectId, "")
		) {
			throw new VoidhashError({
				code: "FORBIDDEN",
				message: "You are not authorized to delete this paywall",
			});
		}

		await ctx.db.delete(paywalls).where(eq(paywalls.id, input.paywallId));
	});
