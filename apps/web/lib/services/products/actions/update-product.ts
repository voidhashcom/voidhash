import {
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import {
	fromUnknownThrow,
	VoidhashBadRequestError,
	VoidhashForbiddenError,
	VoidhashInternalServerError,
	VoidhashNotFoundError,
	VoidhashUnauthorizedError,
} from "@voidhash/lib";
import { z } from "zod";

import { products } from "@voidhash/db";
import { getProductByIdQuery } from "../raw-queries";
import { eq } from "drizzle-orm";
import { err, ok, Result } from "neverthrow";
import { isAuthenticated } from "@/lib/middlewares";

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
	.use(isAuthenticated)
	.function(
		async ({ input, ctx }): Promise<Result<void, UpdateProductError>> => {
			const existingProduct = await getProductByIdQuery(ctx, input.productId);
			if (existingProduct.isErr()) {
				return err(existingProduct.error);
			}

			if (
				!hasProjectPermission(
					ctx,
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
