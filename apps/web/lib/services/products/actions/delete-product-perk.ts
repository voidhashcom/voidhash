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
import { productPerks } from "@voidhash/db";
import { and, eq } from "drizzle-orm";
import { err, ok, Result } from "neverthrow";
import { getProductByIdQuery } from "../raw-queries";
import { isAuthenticated } from "@/lib/middlewares";

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
	.use(isAuthenticated)
	.function(
		async ({ input, ctx }): Promise<Result<void, DeleteProductPerkError>> => {
			const product = await getProductByIdQuery(ctx, input.productId);

			if (product.isErr()) {
				return err(product.error);
			}

			if (!hasProjectPermission(ctx, product.value.projectId, "project:all")) {
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
