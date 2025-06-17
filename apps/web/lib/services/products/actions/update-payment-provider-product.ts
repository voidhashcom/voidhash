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
import { paymentProviderConfigurationProducts } from "@voidhash/db";
import { paymentProviders } from "@/lib/payment-providers/payment-providers";
import { and, eq } from "drizzle-orm";
import { createPaymentProviderKey } from "../lib";
import { err, ok, Result } from "neverthrow";
import {
	getProductByIdQuery,
	getProviderProductByPrimaryKeyQuery,
} from "../raw-queries";
import { hasEnvironment, isAuthenticated } from "@/lib/middlewares";
import { getPaymentProviderConfigurationByIdQuery } from "../../payment-providers/raw-queries";

export const updatePaymentProviderProductInputSchema = z.object({
	productId: z.string(),
	providerProductKey: z.string(),
	paymentProviderConfigurationId: z.string(),
	configuration: z.object({}).passthrough(),
});

type UpdatePaymentProviderProductError =
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError
	| VoidhashInternalServerError
	| VoidhashNotFoundError
	| VoidhashBadRequestError;

export const updatePaymentProviderProduct = createServiceFunction()
	.input(updatePaymentProviderProductInputSchema)
	.use(isAuthenticated)
	.use(hasEnvironment)
	.function(
		async ({
			input,
			ctx,
		}): Promise<Result<void, UpdatePaymentProviderProductError>> => {
			const productQuery = getProductByIdQuery(ctx, input.productId);
			const providerConfigurationQuery =
				getPaymentProviderConfigurationByIdQuery(
					ctx,
					input.paymentProviderConfigurationId
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

			const parsedConfiguration = provider
				.getProductConfigurationSchema()
				.parse(input.configuration);

			const providerProduct = await getProviderProductByPrimaryKeyQuery(
				ctx,
				input.paymentProviderConfigurationId,
				input.providerProductKey,
				ctx.session.environment
			);

			if (providerProduct.isErr()) {
				return err(providerProduct.error);
			}

			const providerProductKey = createPaymentProviderKey(
				provider.getId(),
				parsedConfiguration
			);

			if (providerProductKey.isErr()) {
				return err(providerProductKey.error);
			}

			try {
				await ctx.db
					.update(paymentProviderConfigurationProducts)
					.set({
						providerProductKey: providerProductKey.value,
						configuration: parsedConfiguration,
					})
					.where(
						and(
							eq(
								paymentProviderConfigurationProducts.productId,
								productResult.value.id
							),
							eq(
								paymentProviderConfigurationProducts.paymentProviderConfigurationId,
								providerProduct.value.paymentProviderConfigurationId
							),
							eq(
								paymentProviderConfigurationProducts.providerProductKey,
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
