import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { NotFoundError, UnauthorizedError } from "@voidhash/lib";
import { z } from "zod";
import { db, product } from "@voidhash/db";
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
			throw new NotFoundError("Product not found");
		}

		if (
			!hasProjectPermission(authenticatedContext, existingProduct.projectId, "")
		) {
			throw new UnauthorizedError(
				"You are not authorized to delete this product"
			);
		}

		await db.delete(product).where(eq(product.id, input.productId));
	});
