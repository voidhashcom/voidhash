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
import { productProviderConfigurations } from "@voidhash/db";
import { paymentProviders } from "@/lib/payment-providers/payment-providers";
import { getProductById, getProviderProductByPrimaryKey } from "../queries";
import { and, eq, not } from "drizzle-orm";
import { err, ok, Result } from "neverthrow";

export const setActivePaymentProviderProductInputSchema = z.object({
	productId: z.string(),
	providerProductKey: z.string(),
	providerId: z.enum(
		paymentProviders.map((p) => p.id) as [string, ...string[]]
	),
});

type SetActivePaymentProviderProductError =
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError
	| VoidhashInternalServerError
	| VoidhashNotFoundError
	| VoidhashBadRequestError;

export const setActivePaymentProviderProduct = createServiceFunction()
	.input(setActivePaymentProviderProductInputSchema)
	.function(
		async ({
			input,
			ctx,
		}): Promise<Result<void, SetActivePaymentProviderProductError>> => {
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
					message: "You are not authorized to update this product",
				});
			}

			const provider = paymentProviders.find((p) => p.id === input.providerId);
			if (!provider) {
				return err({
					code: "NOT_FOUND",
					message: "Provider not found",
					resource: "provider",
					payload: {
						id: input.providerId,
					},
				});
			}

			const providerProduct = await getProviderProductByPrimaryKey({
				ctx: authenticatedContext.value,
				input: {
					projectId: product.value.projectId,
					providerId: input.providerId,
					productProviderKey: input.providerProductKey,
				},
			});

			if (providerProduct.isErr()) {
				return err(providerProduct.error);
			}

			if (!providerProduct.value) {
				return err({
					code: "NOT_FOUND",
					message: "Provider product not found",
					resource: "providerProduct",
					payload: {
						providerProductKey: input.providerProductKey,
					},
				});
			}

			// Disable other provider products for this product
			try {
				await ctx.db
					.update(productProviderConfigurations)
					.set({ isActive: false })
					.where(
						and(
							eq(productProviderConfigurations.productId, product.value.id),
							eq(productProviderConfigurations.providerId, input.providerId),
							not(
								eq(
									productProviderConfigurations.providerProductKey,
									providerProduct.value.providerProductKey
								)
							)
						)
					);

				await ctx.db
					.update(productProviderConfigurations)
					.set({
						isActive: true,
					})
					.where(
						and(
							eq(productProviderConfigurations.productId, product.value.id),
							eq(
								productProviderConfigurations.providerId,
								providerProduct.value.providerId
							),
							eq(
								productProviderConfigurations.providerProductKey,
								providerProduct.value.providerProductKey
							)
						)
					);

				return ok(undefined);
			} catch (e) {
				return err(fromUnknownThrow(e));
			}
		}
	);
