import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { NotFoundError, UnauthorizedError } from "@voidhash/lib";
import { z } from "zod";
import { db, paywallProduct } from "@voidhash/db";
import { getProductById } from "../products/queries";

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
			throw new NotFoundError("Product not found");
		}

		if (!hasProjectPermission(authenticatedContext, product.projectId, "")) {
			throw new UnauthorizedError(
				"You are not authorized to create paywall products"
			);
		}

		const newPaywallProduct = {
			productId: product.id,
			paywallId: input.paywallId,
		} satisfies typeof paywallProduct.$inferInsert;

		await db.insert(paywallProduct).values(newPaywallProduct);

		return newPaywallProduct;
	});
