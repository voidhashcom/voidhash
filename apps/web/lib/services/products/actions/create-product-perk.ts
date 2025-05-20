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
import { generateId } from "@/lib/id/generate";
import { getPerkByIdQuery } from "../../perks/raw-queries";
import { err, ok, Result } from "neverthrow";

export const createProductPerkInputSchema = z.object({
	productId: z.string(),
	perkId: z.string(),
});

type CreateProductPerkError =
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError
	| VoidhashInternalServerError
	| VoidhashNotFoundError
	| VoidhashBadRequestError;

export const createProductPerk = createServiceFunction()
	.input(createProductPerkInputSchema)
	.function(
		async ({
			input,
			ctx,
		}): Promise<Result<{ id: string }, CreateProductPerkError>> => {
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

			if (
				!hasProjectPermission(
					authenticatedContext.value,
					product.value.projectId,
					"project:all"
				)
			) {
				return err({
					code: "FORBIDDEN",
					message: "You are not authorized to create payment provider products",
				});
			}

			const perk = await getPerkByIdQuery(
				authenticatedContext.value,
				input.perkId
			);
			if (perk.isErr()) {
				return err(perk.error);
			}

			const newProductPerk = {
				id: generateId("productPerk"),
				productId: product.value.id,
				perkId: input.perkId,
			} satisfies typeof productPerks.$inferInsert;

			try {
				await ctx.db.insert(productPerks).values(newProductPerk);
				return ok({ id: newProductPerk.id });
			} catch (e) {
				return err(fromUnknownThrow(e));
			}
		}
	);
