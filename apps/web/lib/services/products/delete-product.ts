import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { VoidhashError } from "@voidhash/lib";
import { z } from "zod";
import { products } from "@voidhash/db";
import { getProductById } from "./queries";
import { eq } from "drizzle-orm";

export const deleteProductInputSchema = z.object({
	productId: z.string(),
});

export const deleteProduct = createServiceFunction()
	.input(deleteProductInputSchema)
	.function(async ({ input, ctx }) => {
		const authenticatedContext = await authenticateContext(ctx);
		const existingProduct = await getProductById({
			ctx: authenticatedContext,
			input: { id: input.productId },
		});
		if (!existingProduct) {
			throw new VoidhashError({
				code: "NOT_FOUND",
				message: "Product not found",
			});
		}

		if (
			!hasProjectPermission(authenticatedContext, existingProduct.projectId, "")
		) {
			throw new VoidhashError({
				code: "FORBIDDEN",
				message: "You are not authorized to delete this product",
			});
		}

		await ctx.db.delete(products).where(eq(products.id, input.productId));
	});
