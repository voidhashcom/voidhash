import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { VoidhashError } from "@voidhash/lib";
import { z } from "zod";
import { productPerks } from "@voidhash/db";
import { getProductById } from "./queries";
import { and, eq } from "drizzle-orm";

export const deleteProductPerkInputSchema = z.object({
	productId: z.string(),
	perkId: z.string(),
});

export const deleteProductPerk = createServiceFunction()
	.input(deleteProductPerkInputSchema)
	.function(async ({ input, ctx }) => {
		const authenticatedContext = await authenticateContext(ctx);
		const product = await getProductById({
			ctx: authenticatedContext,
			input: { id: input.productId },
		});
		if (!product) {
			throw new VoidhashError({
				code: "NOT_FOUND",
				message: "Product not found",
			});
		}

		if (!hasProjectPermission(authenticatedContext, product.projectId, "")) {
			throw new VoidhashError({
				code: "FORBIDDEN",
				message:
					"You are not authorized to delete this payment provider product",
			});
		}

		await ctx.db
			.delete(productPerks)
			.where(
				and(
					eq(productPerks.productId, product.id),
					eq(productPerks.perkId, input.perkId)
				)
			);

		// TODO: Think about deleting already granted perks.
	});
