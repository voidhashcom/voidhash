import {
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import {
	fromUnknownThrow,
	VoidhashForbiddenError,
	VoidhashInternalServerError,
	VoidhashNotFoundError,
	VoidhashUnauthorizedError,
} from "@voidhash/lib";
import { z } from "zod";
import { paymentProviderConfigurationProducts } from "@voidhash/db";
import { and, eq } from "drizzle-orm";
import { err, ok, Result } from "neverthrow";
import { getProductByIdQuery } from "../raw-queries";
import { isAuthenticated } from "@/lib/middlewares";

export const deletePaymentProviderProductInputSchema = z.object({
	productId: z.string(),
	paymentProviderConfigurationId: z.string(),
	providerProductKey: z.string(),
});

type DeletePaymentProviderProductError =
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError
	| VoidhashInternalServerError
	| VoidhashNotFoundError;

export const deletePaymentProviderProduct = createServiceFunction()
	.input(deletePaymentProviderProductInputSchema)
	.use(isAuthenticated)
	.function(
		async ({
			input,
			ctx,
		}): Promise<Result<void, DeletePaymentProviderProductError>> => {
			const product = await getProductByIdQuery(ctx, input.productId);

			if (product.isErr()) {
				return err(product.error);
			}

			if (!hasProjectPermission(ctx, product.value.projectId, "project:all")) {
				return err({
					code: "FORBIDDEN",
					message:
						"You are not authorized to delete this payment provider product",
				});
			}

			try {
				await ctx.db
					.delete(paymentProviderConfigurationProducts)
					.where(
						and(
							eq(
								paymentProviderConfigurationProducts.productId,
								product.value.id
							),
							eq(
								paymentProviderConfigurationProducts.paymentProviderConfigurationId,
								input.paymentProviderConfigurationId
							),
							eq(
								paymentProviderConfigurationProducts.providerProductKey,
								input.providerProductKey
							)
						)
					);
				return ok(undefined);
			} catch (e) {
				return err(fromUnknownThrow(e));
			}
		}
	);
