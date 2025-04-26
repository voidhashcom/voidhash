import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { createId, VoidhashError } from "@voidhash/lib";
import { z } from "zod";
import { productProviderConfiguration } from "@voidhash/db";
import { paymentProviders } from "@/lib/payment-providers/payment-providers";
import { getProductById } from "./queries";
import { and, eq } from "drizzle-orm";

export const createPaymentProviderProductInputSchema = z.object({
	productId: z.string(),
	providerId: z.enum(
		paymentProviders.map((p) => p.id) as [string, ...string[]]
	),
	configuration: z.object({}).passthrough(),
});

export const createPaymentProviderProduct = createServiceFunction()
	.input(createPaymentProviderProductInputSchema)
	.function(async ({ input, ctx }) => {
		const authenticatedContext = await authenticateContext(ctx);
		const product = await getProductById({
			ctx: authenticatedContext,
			input: { id: input.productId },
		});
		if (!product) {
			throw new VoidhashError({
				code: "NOT_FOUND",
				message: "Product not found",
			});
		}

		if (!hasProjectPermission(authenticatedContext, product.projectId, "")) {
			throw new VoidhashError({
				code: "UNAUTHORIZED",
				message: "You are not authorized to create payment provider products",
			});
		}

		const provider = paymentProviders.find((p) => p.id === input.providerId);
		if (!provider) {
			throw new VoidhashError({
				code: "NOT_FOUND",
				message: "Provider not found",
			});
		}

		const parsedConfiguration =
			provider.products.productConfigurationSchema.parse(input.configuration);

		// Disable other provider products for this product
		await ctx.db
			.update(productProviderConfiguration)
			.set({ isActive: false })
			.where(
				and(
					eq(productProviderConfiguration.productId, product.id),
					eq(productProviderConfiguration.providerId, input.providerId)
				)
			);

		const newPaymentProviderProduct = {
			id: createId(),
			productId: product.id,
			providerId: input.providerId,
			providerProductKey: provider.products.keyProperties
				.map((key) => parsedConfiguration[key])
				.join(":"),
			configuration: parsedConfiguration,
		} satisfies typeof productProviderConfiguration.$inferInsert;

		await ctx.db
			.insert(productProviderConfiguration)
			.values(newPaymentProviderProduct);

		return newPaymentProviderProduct;
	});
