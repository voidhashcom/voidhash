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
import { productProviderConfigurations } from "@voidhash/db";
import { paymentProviders } from "@/lib/payment-providers/paymentProviders";
import { and, eq, not } from "drizzle-orm";
import { err, ok, Result } from "neverthrow";
import {
	getProductByIdQuery,
	getProviderProductByPrimaryKeyQuery,
} from "../raw-queries";
import { isAuthenticated } from "@/lib/middlewares";

export const setActivePaymentProviderProductInputSchema = z.object({
	productId: z.string(),
	providerProductKey: z.string(),
	providerId: z.enum(
		paymentProviders.map((p) => p.getId()) as [string, ...string[]]
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
	.use(isAuthenticated)
	.function(
		async ({
			input,
			ctx,
		}): Promise<Result<void, SetActivePaymentProviderProductError>> => {
			const product = await getProductByIdQuery(ctx, input.productId);

			if (product.isErr()) {
				return err(product.error);
			}

			if (!hasProjectPermission(ctx, product.value.projectId, "project:all")) {
				return err({
					code: "FORBIDDEN",
					message: "You are not authorized to update this product",
				});
			}

			const provider = paymentProviders.find(
				(p) => p.getId() === input.providerId
			);
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

			const providerProduct = await getProviderProductByPrimaryKeyQuery(
				ctx,
				product.value.projectId,
				input.providerId,
				input.providerProductKey
			);

			if (providerProduct.isErr()) {
				return err(providerProduct.error);
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
