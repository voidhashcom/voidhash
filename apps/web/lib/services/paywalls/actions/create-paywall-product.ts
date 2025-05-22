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
import { PaywallProduct, paywallProducts } from "@voidhash/db";
import { generateId } from "@/lib/id/generate";
import { err, ok, Result } from "neverthrow";
import { getProductByIdQuery } from "../../products/raw-queries";

export const createPaywallProductInputSchema = z.object({
	productId: z.string(),
	paywallId: z.string(),
});

type CreatePaywallProductError =
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError
	| VoidhashBadRequestError
	| VoidhashInternalServerError
	| VoidhashNotFoundError;

export const createPaywallProduct = createServiceFunction()
	.input(createPaywallProductInputSchema)
	.function(
		async ({
			input,
			ctx,
		}): Promise<Result<PaywallProduct, CreatePaywallProductError>> => {
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
					message: "You are not authorized to create paywall products",
				});
			}

			const newPaywallProduct = {
				id: generateId("paywallProduct"),
				productId: product.value.id,
				paywallId: input.paywallId,
			} satisfies typeof paywallProducts.$inferInsert;

			try {
				await ctx.db.insert(paywallProducts).values(newPaywallProduct);
				return ok({
					...newPaywallProduct,
					createdAt: new Date(),
					updatedAt: new Date(),
				});
			} catch (error) {
				return err(fromUnknownThrow(error));
			}
		}
	);
