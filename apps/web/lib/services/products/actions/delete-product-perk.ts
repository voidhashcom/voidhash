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
import { productPerks } from "@voidhash/db";
import { getProductById } from "../queries";
import { and, eq } from "drizzle-orm";
import { err, ok, Result } from "neverthrow";

export const deleteProductPerkInputSchema = z.object({
	productId: z.string(),
	perkId: z.string(),
});

type DeleteProductPerkError =
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError
	| VoidhashInternalServerError
	| VoidhashNotFoundError
	| VoidhashBadRequestError;

export const deleteProductPerk = createServiceFunction()
	.input(deleteProductPerkInputSchema)
	.function(
		async ({ input, ctx }): Promise<Result<void, DeleteProductPerkError>> => {
			const authenticatedContext = await authenticateContext(ctx);
			if (authenticatedContext.isErr()) {
				return err(authenticatedContext.error);
			}

			const product = await getProductById({
				ctx: authenticatedContext.value,
				input: { id: input.productId },
			});

			if (product.isErr()) {
				return err(product.error);
			}

			if (!product.value) {
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
					product.value.projectId,
					"project:all"
				)
			) {
				return err({
					code: "FORBIDDEN",
					message:
						"You are not authorized to delete this payment provider product",
				});
			}

			try {
				await ctx.db
					.delete(productPerks)
					.where(
						and(
							eq(productPerks.productId, product.value.id),
							eq(productPerks.perkId, input.perkId)
						)
					);
				return ok(undefined);
			} catch (e) {
				return err(fromUnknownThrow(e));
			}

			// TODO: Think about deleting already granted perks.
		}
	);
