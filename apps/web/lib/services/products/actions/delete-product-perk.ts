import {
	authenticateContext,
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
import { productPerks } from "@voidhash/db";
import { and, eq } from "drizzle-orm";
import { err, ok, Result } from "neverthrow";
import { getProductByIdQuery } from "../raw-queries";

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

			const product = await getProductByIdQuery(
				authenticatedContext.value,
				input.productId
			);

			if (product.isErr()) {
				return err(product.error);
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
