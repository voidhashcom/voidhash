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
import { eq, inArray, paywallProducts, paywalls, products } from "@voidhash/db";
import { generateId } from "@/lib/id/generate";
import { err, ok, Result } from "neverthrow";
import { getPaywallByIdQuery } from "../raw-queries";
import { isAuthenticated } from "@/lib/middlewares";

export const updatePaywallInputSchema = z.object({
	paywallId: z.string(),
	name: z.string().min(3, "Name must be at least 3 characters long").optional(),
	paywallProducts: z
		.array(
			z.object({
				productId: z.string().min(1, "Product ID is required"),
				displayName: z
					.string()
					.min(2, "Display name must be at least 2 characters long"),
				enableNativePurchase: z.boolean(),
				enableWebCheckout: z.boolean(),
				webCheckoutPaymentProviderId: z.string().nullable(),
				order: z.number(),
			})
		)
		.optional(),
});

type CreatePaywallProductError =
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError
	| VoidhashBadRequestError
	| VoidhashInternalServerError
	| VoidhashNotFoundError;

export const updatePaywall = createServiceFunction()
	.input(updatePaywallInputSchema)
	.use(isAuthenticated)
	.function(
		async ({
			input,
			ctx,
		}): Promise<Result<void, CreatePaywallProductError>> => {
			const paywall = await getPaywallByIdQuery(ctx, input.paywallId);
			if (paywall.isErr()) {
				return err(paywall.error);
			}

			if (!hasProjectPermission(ctx, paywall.value.projectId, "project:all")) {
				return err({
					code: "FORBIDDEN",
					message: "You are not authorized to create paywall products",
				});
			}

			try {
				await ctx.db.transaction(async (tx) => {
					if (input.name) {
						await tx
							.update(paywalls)
							.set({
								name: input.name,
								updatedAt: new Date(),
							})
							.where(eq(paywalls.id, input.paywallId));
					}
					if (input.paywallProducts) {
						await tx
							.delete(paywallProducts)
							.where(eq(paywallProducts.paywallId, input.paywallId));

						const productsFromDb = await tx
							.select()
							.from(products)
							.where(
								inArray(
									products.id,
									input.paywallProducts.map((p) => p.productId)
								)
							);

						for (const product of input.paywallProducts.sort(
							(a, b) => a.order - b.order
						)) {
							const existingProduct = productsFromDb.find(
								(p) => p.id === product.productId
							);

							if (!existingProduct) {
								return err({
									code: "BAD_REQUEST",
									message: `Product with id ${product.productId} not found`,
								} satisfies VoidhashBadRequestError);
							}

							await tx.insert(paywallProducts).values({
								id: generateId("paywallProduct"),
								displayName: product.displayName,
								order: product.order,
								paywallId: input.paywallId,
								productId: existingProduct.id,
								enableNativePurchase: product.enableNativePurchase,
								enableWebCheckout: product.enableWebCheckout,
								webCheckoutPaymentProviderId:
									product.webCheckoutPaymentProviderId,
							});
						}
					}
				});

				return ok(undefined);
			} catch (error) {
				return err(fromUnknownThrow(error));
			}
		}
	);
