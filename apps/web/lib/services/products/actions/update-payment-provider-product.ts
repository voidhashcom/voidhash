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
import { and, eq } from "drizzle-orm";
import { createPaymentProviderKey } from "../lib";
import { err, ok, Result } from "neverthrow";
import {
	getProductByIdQuery,
	getProviderProductByPrimaryKeyQuery,
} from "../raw-queries";
import { isAuthenticated } from "@/lib/middlewares";

export const updatePaymentProviderProductInputSchema = z.object({
	productId: z.string(),
	providerProductKey: z.string(),
	providerId: z.enum(
		paymentProviders.map((p) => p.getId()) as [string, ...string[]]
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
	.use(isAuthenticated)
	.function(
		async ({
			input,
			ctx,
		}): Promise<Result<void, UpdatePaymentProviderProductError>> => {
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

			const parsedConfiguration = provider
				.getProductConfigurationSchema()
				.parse(input.configuration);

			const providerProduct = await getProviderProductByPrimaryKeyQuery(
				ctx,
				product.value.projectId,
				input.providerId,
				input.providerProductKey
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
