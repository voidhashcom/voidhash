import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { NotFoundError, UnauthorizedError } from "@voidhash/lib";
import { z } from "zod";
import { db, productProviderConfiguration } from "@voidhash/db";
import { paymentProviders } from "@/lib/payment-providers/payment-providers";
import { getProductById } from "./queries";

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
			throw new NotFoundError("Product not found");
		}

		if (!hasProjectPermission(authenticatedContext, product.projectId, "")) {
			throw new UnauthorizedError(
				"You are not authorized to create payment provider products"
			);
		}

		const provider = paymentProviders.find((p) => p.id === input.providerId);
		if (!provider) {
			throw new NotFoundError("Provider not found");
		}

		const parsedConfiguration =
			provider.products.productConfigurationSchema.parse(input.configuration);

		const newPaymentProviderProduct = {
			productId: product.id,
			providerId: input.providerId,
			providerProductKey: provider.products.keyProperties
				.map((key) => parsedConfiguration[key])
				.join(":"),
			configuration: parsedConfiguration,
		} satisfies typeof productProviderConfiguration.$inferInsert;

		await db
			.insert(productProviderConfiguration)
			.values(newPaymentProviderProduct);

		return newPaymentProviderProduct;
	});
