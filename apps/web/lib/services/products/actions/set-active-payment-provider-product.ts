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
import { paymentProviders } from "@/lib/payment-providers/payment-providers";
import { and, eq, not } from "drizzle-orm";
import { err, ok, Result } from "neverthrow";
import { getProductByIdQuery } from "../raw-queries";
import { hasEnvironment, isAuthenticated } from "@/lib/middlewares";
import { getPaymentProviderConfigurationByIdQuery } from "../../payment-providers/raw-queries";

export const setActivePaymentProviderProductInputSchema = z.object({
	productId: z.string(),
	providerProductKey: z.string(),
	providerConfigurationId: z.string(),
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
	.use(hasEnvironment)
	.function(
		async ({
			input,
			ctx,
		}): Promise<Result<void, SetActivePaymentProviderProductError>> => {
			const productQuery = getProductByIdQuery(ctx, input.productId);
			const providerConfigurationQuery =
				getPaymentProviderConfigurationByIdQuery(
					ctx,
					input.providerConfigurationId
				);

			const [productResult, providerConfigurationResult] = await Promise.all([
				productQuery,
				providerConfigurationQuery,
			]);

			if (productResult.isErr()) {
				return err(productResult.error);
			}

			if (providerConfigurationResult.isErr()) {
				return err(providerConfigurationResult.error);
			}

			if (
				!hasProjectPermission(
					ctx,
					productResult.value.projectId,
					"project:all"
				) ||
				!hasProjectPermission(
					ctx,
					providerConfigurationResult.value.projectId,
					"project:all"
				)
			) {
				return err({
					code: "FORBIDDEN",
					message: "You are not authorized to update this product",
				});
			}

			const provider = paymentProviders.find(
				(p) => p.getId() === providerConfigurationResult.value.providerId
			);
			if (!provider) {
				return err({
					code: "NOT_FOUND",
					message: "Provider not found",
					resource: "provider",
					payload: {
						id: providerConfigurationResult.value.providerId,
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
							eq(
								productProviderConfigurations.productId,
								productResult.value.id
							),
							eq(
								productProviderConfigurations.providerConfigurationId,
								providerConfigurationResult.value.id
							),
							not(
								eq(
									productProviderConfigurations.providerProductKey,
									input.providerProductKey
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
							eq(
								productProviderConfigurations.productId,
								productResult.value.id
							),
							eq(
								productProviderConfigurations.providerConfigurationId,
								providerConfigurationResult.value.id
							),
							eq(
								productProviderConfigurations.providerProductKey,
								input.providerProductKey
							)
						)
					);

				return ok(undefined);
			} catch (e) {
				return err(fromUnknownThrow(e));
			}
		}
	);
