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
	.use(isAuthenticated)
	.function(
		async ({ input, ctx }): Promise<Result<void, DeleteProductError>> => {
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
