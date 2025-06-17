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
import { generateId } from "@/lib/id/generate";
import { err, ok, Result } from "neverthrow";
import { getProductByIdQuery } from "../raw-queries";
import { hasEnvironment, isAuthenticated } from "@/lib/middlewares";
import { getPaymentProviderConfigurationByIdQuery } from "../../payment-providers/raw-queries";

export const createPaymentProviderProductInputSchema = z.object({
	productId: z.string(),
	paymentProviderConfigurationId: z.string(),
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
	.use(hasEnvironment)
	.function(
		async ({
			input,
			ctx,
		}): Promise<
			Result<
				typeof paymentProviderConfigurationProducts.$inferInsert,
				CreatePaymentProviderProductError
			>
		> => {
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
					message: "You are not authorized to create payment provider products",
				});
			}

			const provider = paymentProviders.find(
				(p) => p.getId() === providerConfigurationResult.value.providerId
			);
			if (!provider) {
				return err({
					code: "NOT_FOUND",
					message: `Provider ${providerConfigurationResult.value.providerId} not found`,
					resource: "payment_provider",
					payload: {
						providerId: providerConfigurationResult.value.providerId,
					},
				});
			}

			const parseConfigurationSchema = Result.fromThrowable(
				provider.getProductConfigurationSchema().parse,
				(e) =>
					({
						code: "BAD_REQUEST",
						message: `Invalid configuration for provider ${providerConfigurationResult.value.providerId}`,
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
					.update(paymentProviderConfigurationProducts)
					.set({ isActive: false })
					.where(
						and(
							eq(
								paymentProviderConfigurationProducts.productId,
								productResult.value.id
							),
							eq(
								paymentProviderConfigurationProducts.paymentProviderConfigurationId,
								input.paymentProviderConfigurationId
							)
						)
					);

				const newPaymentProviderProduct = {
					id: generateId("paymentProviderProduct"),
					productId: productResult.value.id,
					paymentProviderConfigurationId: providerConfigurationResult.value.id,
					providerProductKey: provider.createProductKey(
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						parsedConfiguration.value as any
					),
					environment: ctx.session.environment,
					configuration: parsedConfiguration.value,
					isActive: true,
				} satisfies typeof paymentProviderConfigurationProducts.$inferInsert;

				await ctx.db
					.insert(paymentProviderConfigurationProducts)
					.values(newPaymentProviderProduct);

				return ok(newPaymentProviderProduct);
			} catch (e) {
				return err(fromUnknownThrow(e));
			}
		}
	);
