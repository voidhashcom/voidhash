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
import { and, eq } from "drizzle-orm";
import { createPaymentProviderKey } from "../lib";
import { err, ok, Result } from "neverthrow";

export const updatePaymentProviderProductInputSchema = z.object({
	productId: z.string(),
	providerProductKey: z.string(),
	providerId: z.enum(
		paymentProviders.map((p) => p.id) as [string, ...string[]]
	),
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
	.function(
		async ({
			input,
			ctx,
		}): Promise<Result<void, UpdatePaymentProviderProductError>> => {
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

			const parsedConfiguration =
				provider.products.productConfigurationSchema.parse(input.configuration);

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

			const providerProductKey = createPaymentProviderKey(
				provider.id,
				parsedConfiguration
			);

			if (providerProductKey.isErr()) {
				return err(providerProductKey.error);
			}

			try {
				await ctx.db
					.update(productProviderConfigurations)
					.set({
						providerProductKey: providerProductKey.value,
						configuration: parsedConfiguration,
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
