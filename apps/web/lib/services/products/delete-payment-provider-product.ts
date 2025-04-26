import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { VoidhashError } from "@voidhash/lib";
import { z } from "zod";
import { productProviderConfiguration } from "@voidhash/db";
import { paymentProviders } from "@/lib/payment-providers/payment-providers";
import { getProductById } from "./queries";
import { and, eq } from "drizzle-orm";

export const deletePaymentProviderProductInputSchema = z.object({
	productId: z.string(),
	providerId: z.enum(
		paymentProviders.map((p) => p.id) as [string, ...string[]]
	),
	providerProductKey: z.string(),
});

export const deletePaymentProviderProduct = createServiceFunction()
	.input(deletePaymentProviderProductInputSchema)
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
				message:
					"You are not authorized to delete this payment provider product",
			});
		}

		await ctx.db
			.delete(productProviderConfiguration)
			.where(
				and(
					eq(productProviderConfiguration.productId, product.id),
					eq(
						productProviderConfiguration.providerProductKey,
						input.providerProductKey
					)
				)
			);
	});
