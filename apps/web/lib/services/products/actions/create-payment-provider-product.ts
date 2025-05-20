import {
	authenticateContext,
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
import { getProductById } from "../queries";
import { and, eq } from "drizzle-orm";
import { generateId } from "@/lib/id/generate";
import { err, ok, Result } from "neverthrow";

export const createPaymentProviderProductInputSchema = z.object({
	productId: z.string(),
	providerId: z.enum(
		paymentProviders.map((p) => p.id) as [string, ...string[]]
	),
	configuration: z.object({}).passthrough(),
});

type CreatePaymentProviderProductError =
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError
	| VoidhashInternalServerError
	| VoidhashNotFoundError
	| VoidhashBadRequestError;

export const createPaymentProviderProduct = createServiceFunction()
	.input(createPaymentProviderProductInputSchema)
	.function(
		async ({
			input,
			ctx,
		}): Promise<
			Result<
				typeof productProviderConfigurations.$inferInsert,
				CreatePaymentProviderProductError
			>
		> => {
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
					code: "BAD_REQUEST",
					message: `Product ${input.productId} not found`,
					resource: "product",
					payload: { id: input.productId },
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
					message: "You are not authorized to create payment provider products",
				});
			}

			const provider = paymentProviders.find((p) => p.id === input.providerId);
			if (!provider) {
				return err({
					code: "BAD_REQUEST",
					message: `Provider ${input.providerId} not found`,
				});
			}

			provider.products.productConfigurationSchema.parse(input.configuration);
			const parseConfigurationSchema = Result.fromThrowable(
				provider.products.productConfigurationSchema.parse,
				(e) =>
					({
						code: "BAD_REQUEST",
						message: `Invalid configuration for provider ${input.providerId}`,
						validationErrors: e,
					}) as VoidhashBadRequestError
			);
			const parsedConfiguration = parseConfigurationSchema(input.configuration);
			if (parsedConfiguration.isErr()) {
				return err(parsedConfiguration.error);
			}

			// Disable other provider products for this product
			try {
				await ctx.db
					.update(productProviderConfigurations)
					.set({ isActive: false })
					.where(
						and(
							eq(productProviderConfigurations.productId, product.value.id),
							eq(productProviderConfigurations.providerId, input.providerId)
						)
					);

				const newPaymentProviderProduct = {
					id: generateId("paymentProviderProduct"),
					productId: product.value.id,
					providerId: input.providerId,
					providerProductKey: provider.products.keyProperties
						.map((key) => parsedConfiguration.value[key])
						.join(":"),
					configuration: parsedConfiguration.value,
				} satisfies typeof productProviderConfigurations.$inferInsert;

				await ctx.db
					.insert(productProviderConfigurations)
					.values(newPaymentProviderProduct);

				return ok(newPaymentProviderProduct);
			} catch (e) {
				return err(fromUnknownThrow(e));
			}
		}
	);
