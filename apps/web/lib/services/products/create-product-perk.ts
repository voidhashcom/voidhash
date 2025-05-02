import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { VoidhashError } from "@voidhash/lib";
import { z } from "zod";
import { productPerks } from "@voidhash/db";
import { getProductById } from "./queries";
import { generateId } from "@/lib/id/generate";
import { getPerkByIdQuery } from "../perks/raw-queries";

export const createProductPerkInputSchema = z.object({
	productId: z.string(),
	perkId: z.string(),
});

export const createProductPerk = createServiceFunction()
	.input(createProductPerkInputSchema)
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
				message: "You are not authorized to create payment provider products",
			});
		}

		const perk = await getPerkByIdQuery(authenticatedContext, input.perkId);
		if (!perk) {
			throw new VoidhashError({
				code: "NOT_FOUND",
				message: "Perk not found",
			});
		}

		const newProductPerk = {
			id: generateId("productPerk"),
			productId: product.id,
			perkId: input.perkId,
		} satisfies typeof productPerks.$inferInsert;

		await ctx.db.insert(productPerks).values(newProductPerk);

		return newProductPerk;
	});
