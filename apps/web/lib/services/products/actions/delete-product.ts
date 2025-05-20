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

export const deleteProductInputSchema = z.object({
	productId: z.string(),
});

type DeleteProductError =
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError
	| VoidhashInternalServerError
	| VoidhashNotFoundError
	| VoidhashBadRequestError;

export const deleteProduct = createServiceFunction()
	.input(deleteProductInputSchema)
	.function(
		async ({ input, ctx }): Promise<Result<void, DeleteProductError>> => {
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
					message: "You are not authorized to delete this product",
				});
			}

			try {
				await ctx.db.delete(products).where(eq(products.id, input.productId));
				return ok(undefined);
			} catch (e) {
				return err(fromUnknownThrow(e));
			}
		}
	);
