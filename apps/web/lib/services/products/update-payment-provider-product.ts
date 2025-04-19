import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { NotFoundError, UnauthorizedError } from "@voidhash/lib";
import { z } from "zod";
import { db, productProviderConfiguration } from "@voidhash/db";
import { paymentProviders } from "@/lib/payment-providers/payment-providers";
import { getProductById, getProviderProductByPrimaryKey } from "./queries";
import { and, eq } from "drizzle-orm";

export const updatePaymentProviderProductInputSchema = z.object({
	productId: z.string(),
	providerProductKey: z.string(),
	providerId: z.enum(
		paymentProviders.map((p) => p.id) as [string, ...string[]]
	),
	configuration: z.object({}).passthrough(),
});

export const updatePaymentProviderProduct = createServiceFunction()
	.input(updatePaymentProviderProductInputSchema)
	.function(async ({ input, ctx }) => {
		const authenticatedContext = await authenticateContext(ctx);
		const product = await getProductById({
			ctx: authenticatedContext,
			input: { id: input.productId },
		});
		if (!product) {
			throw new NotFoundError("Product not found");
		}

		if (!hasProjectPermission(authenticatedContext, product.projectId, "")) {
			throw new UnauthorizedError(
				"You are not authorized to update this product"
			);
		}

		const provider = paymentProviders.find((p) => p.id === input.providerId);
		if (!provider) {
			throw new NotFoundError("Provider not found");
		}

		const parsedConfiguration =
			provider.products.productConfigurationSchema.parse(input.configuration);

		const providerProduct = await getProviderProductByPrimaryKey({
			ctx: authenticatedContext,
			input: {
				projectId: product.projectId,
				providerId: input.providerId,
				productProviderKey: input.providerProductKey,
			},
		});

		if (!providerProduct) {
			throw new NotFoundError("Provider product not found");
		}

		const providerProductKey = provider.products.keyProperties
			.map((key) => parsedConfiguration[key])
			.join(":");

		await db
			.update(productProviderConfiguration)
			.set({
				providerProductKey,
				configuration: parsedConfiguration,
			})
			.where(
				and(
					eq(productProviderConfiguration.productId, product.id),
					eq(
						productProviderConfiguration.providerId,
						providerProduct.providerId
					),
					eq(
						productProviderConfiguration.providerProductKey,
						providerProduct.providerProductKey
					)
				)
			);

		return {
			...providerProduct,
			providerProductKey,
			configuration: parsedConfiguration,
		};
	});
