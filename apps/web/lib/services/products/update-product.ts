import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { NotFoundError, UnauthorizedError } from "@voidhash/lib";
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
				"You are not authorized to update this product"
			);
		}

		await db
			.update(product)
			.set({
				name: input.name,
			})
			.where(eq(product.id, input.productId));

		return { ...existingProduct, name: input.name };
	});
