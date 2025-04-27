import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { VoidhashError } from "@voidhash/lib";
import { z } from "zod";
import { paywallProduct } from "@voidhash/db";
import { and, eq } from "drizzle-orm";
import { getPaywallById } from "./queries";

export const deletePaywallProductInputSchema = z.object({
	paywallId: z.string(),
	productId: z.string(),
});

export const deletePaywallProduct = createServiceFunction()
	.input(deletePaywallProductInputSchema)
	.function(async ({ input, ctx }) => {
		const authenticatedContext = await authenticateContext(ctx);
		const paywall = await getPaywallById({
			ctx: authenticatedContext,
			input: { id: input.paywallId },
		});
		if (!paywall) {
			throw new VoidhashError({
				code: "NOT_FOUND",
				message: "Product not found",
			});
		}

		if (!hasProjectPermission(authenticatedContext, paywall.projectId, "")) {
			throw new VoidhashError({
				code: "FORBIDDEN",
				message: "You are not authorized to remove this product",
			});
		}

		await ctx.db
			.delete(paywallProduct)
			.where(
				and(
					eq(paywallProduct.productId, input.productId),
					eq(paywallProduct.paywallId, input.paywallId)
				)
			);
	});
