import { createServiceFunction } from "@/lib/service-function";
import { NotFoundError } from "@voidhash/lib";
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
		const existingProduct = await getProductById({
			ctx,
			input: { id: input.productId },
		});
		if (!existingProduct) {
			throw new NotFoundError("Product not found");
		}

		await db.delete(product).where(eq(product.id, input.productId));
	});
