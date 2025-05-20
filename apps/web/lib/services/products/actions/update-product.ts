import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import {
	fromUnknownThrow,
	VoidhashBadRequestError,
	VoidhashError,
	VoidhashForbiddenError,
	VoidhashInternalServerError,
	VoidhashNotFoundError,
	VoidhashUnauthorizedError,
} from "@voidhash/lib";
import { z } from "zod";

import { products } from "@voidhash/db";
import { getProductById } from "../queries";
import { eq } from "drizzle-orm";
import { err, ok, Result } from "neverthrow";

export const updateProductInputSchema = z.object({
	productId: z.string(),
	name: z
		.string()
		.min(3, "Name must be at least 3 characters long")
		.max(32, "Name must be less than 32 characters"),
});

type UpdateProductError =
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError
	| VoidhashInternalServerError
	| VoidhashNotFoundError
	| VoidhashBadRequestError;

export const updateProduct = createServiceFunction()
	.input(updateProductInputSchema)
	.function(
		async ({ input, ctx }): Promise<Result<void, UpdateProductError>> => {
			const authenticatedContext = await authenticateContext(ctx);
			if (authenticatedContext.isErr()) {
				return err(authenticatedContext.error);
			}

			const existingProduct = await getProductById({
				ctx: authenticatedContext.value,
				input: { id: input.productId },
			});
			if (existingProduct.isErr()) {
				return err(existingProduct.error);
			}

			if (!existingProduct.value) {
				return err({
					code: "NOT_FOUND",
					message: "Product not found",
					resource: "product",
					payload: {
						id: input.productId,
					},
				});
			}

			if (
				!hasProjectPermission(
					authenticatedContext.value,
					existingProduct.value.projectId,
					"project:all"
				)
			) {
				return err({
					code: "FORBIDDEN",
					message: "You are not authorized to update this product",
				});
			}

			try {
				await ctx.db
					.update(products)
					.set({
						name: input.name,
					})
					.where(eq(products.id, input.productId));

				return ok(undefined);
			} catch (e) {
				return err(fromUnknownThrow(e));
			}
		}
	);
