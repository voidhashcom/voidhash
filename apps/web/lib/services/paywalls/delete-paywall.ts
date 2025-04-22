import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { NotFoundError, UnauthorizedError } from "@voidhash/lib";
import { z } from "zod";
import { db, paywall } from "@voidhash/db";
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
			throw new NotFoundError("Paywall not found");
		}

		if (
			!hasProjectPermission(authenticatedContext, existingPaywall.projectId, "")
		) {
			throw new UnauthorizedError(
				"You are not authorized to delete this paywall"
			);
		}

		await db.delete(paywall).where(eq(paywall.id, input.paywallId));
	});
