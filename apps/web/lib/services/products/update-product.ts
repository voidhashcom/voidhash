import { createServiceFunction } from "@/lib/service-function";
import { NotFoundError } from "@voidhash/lib";
import { z } from "zod";

import { product, db } from "@voidhash/db";
import { getProductById } from "./queries";
import { eq } from "drizzle-orm";

export const updateProductInputSchema = z.object({
	productId: z.string(),
	name: z
		.string()
		.min(3, "Name must be at least 3 characters long")
		.max(32, "Name must be less than 32 characters"),
});

export const updateProduct = createServiceFunction()
	.input(updateProductInputSchema)
	.function(async ({ input, ctx }) => {
		// Auth check
		const existingProduct = await getProductById({
			ctx,
			input: { id: input.productId },
		});
		if (!existingProduct) {
			throw new NotFoundError("Product not found");
		}

		await db
			.update(product)
			.set({
				name: input.name,
			})
			.where(eq(product.id, input.productId));

		return { ...existingProduct, name: input.name };
	});
