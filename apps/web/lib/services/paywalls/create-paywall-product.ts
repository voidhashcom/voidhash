import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { VoidhashError } from "@voidhash/lib";
import { z } from "zod";
import { paywallProduct } from "@voidhash/db";
import { getProductById } from "../products/queries";
import { generateId } from "@/lib/id/generate";

export const createPaywallProductInputSchema = z.object({
	productId: z.string(),
	paywallId: z.string(),
});

export const createPaywallProduct = createServiceFunction()
	.input(createPaywallProductInputSchema)
	.function(async ({ input, ctx }) => {
		const authenticatedContext = await authenticateContext(ctx);
		const product = await getProductById({
			ctx: authenticatedContext,
			input: { id: input.productId },
		});
		if (!product) {
			throw new VoidhashError({
				code: "NOT_FOUND",
				message: "Product not found",
			});
		}

		if (!hasProjectPermission(authenticatedContext, product.projectId, "")) {
			throw new VoidhashError({
				code: "FORBIDDEN",
				message: "You are not authorized to create paywall products",
			});
		}

		const newPaywallProduct = {
			id: generateId("paywallProduct"),
			productId: product.id,
			paywallId: input.paywallId,
		} satisfies typeof paywallProduct.$inferInsert;

		await ctx.db.insert(paywallProduct).values(newPaywallProduct);

		return newPaywallProduct;
	});
