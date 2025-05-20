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
import { err, ok, Result } from "neverthrow";

export const deletePaymentProviderProductInputSchema = z.object({
	productId: z.string(),
	providerId: z.enum(
		paymentProviders.map((p) => p.id) as [string, ...string[]]
	),
	providerProductKey: z.string(),
});

type DeletePaymentProviderProductError =
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError
	| VoidhashInternalServerError
	| VoidhashNotFoundError
	| VoidhashBadRequestError;

export const deletePaymentProviderProduct = createServiceFunction()
	.input(deletePaymentProviderProductInputSchema)
	.function(
		async ({
			input,
			ctx,
		}): Promise<Result<void, DeletePaymentProviderProductError>> => {
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
					message:
						"You are not authorized to delete this payment provider product",
				});
			}

			try {
				await ctx.db
					.delete(productProviderConfigurations)
					.where(
						and(
							eq(productProviderConfigurations.productId, product.value.id),
							eq(
								productProviderConfigurations.providerProductKey,
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
