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
import { generateId } from "@/lib/id/generate";
import { err, ok, Result } from "neverthrow";
import { getProductByIdQuery } from "../raw-queries";
import { isAuthenticated } from "@/lib/middlewares";

export const createPaymentProviderProductInputSchema = z.object({
	productId: z.string(),
	providerId: z.enum(
		paymentProviders.map((p) => p.getId()) as [string, ...string[]]
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
	.use(isAuthenticated)
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
			const product = await getProductByIdQuery(ctx, input.productId);
			if (product.isErr()) {
				return err(product.error);
			}
			if (!hasProjectPermission(ctx, product.value.projectId, "project:all")) {
				return err({
					code: "FORBIDDEN",
					message: "You are not authorized to create payment provider products",
				});
			}

			const provider = paymentProviders.find(
				(p) => p.getId() === input.providerId
			);
			if (!provider) {
				return err({
					code: "NOT_FOUND",
					message: `Provider ${input.providerId} not found`,
					resource: "payment_provider",
					payload: {
						providerId: input.providerId,
					},
				});
			}

			provider.getProductConfigurationSchema().parse(input.configuration);
			const parseConfigurationSchema = Result.fromThrowable(
				provider.getProductConfigurationSchema().parse,
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
					providerProductKey: provider
						.getProductKeyProperties()
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
