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
import {
	productProviderConfigurations,
	products,
	Transaction,
} from "@voidhash/db";
import { generateId } from "@/lib/id/generate";
import { err, ok, Result } from "neverthrow";
import { hasEnvironment, isAuthenticated } from "@/lib/middlewares";
import {
	devCheckout,
	devCheckoutPaymentProviderId,
} from "@/lib/payment-providers/dev-checkout/dev-checkout";

export const createProductInputSchema = z.object({
	projectId: z.string(),
	name: z
		.string()
		.min(3, "Name must be at least 3 characters long")
		.max(32, "Name must be less than 32 characters"),
});

type CreateProductError =
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError
	| VoidhashInternalServerError
	| VoidhashNotFoundError
	| VoidhashBadRequestError;

export const createProduct = createServiceFunction()
	.input(createProductInputSchema)
	.use(isAuthenticated)
	.use(hasEnvironment)
	.function(
		async ({
			input,
			ctx,
		}): Promise<Result<{ id: string }, CreateProductError>> => {
			if (!hasProjectPermission(ctx, input.projectId, "project:all")) {
				return err({
					code: "FORBIDDEN",
					message: "You are not authorized to create products",
				});
			}

			const newProduct = {
				id: generateId("product"),
				projectId: input.projectId,
				name: input.name,
				environment: ctx.session.environment,
			};

			try {
				return await ctx.db.transaction(async (tx: Transaction) => {
					await tx.insert(products).values(newProduct);

					if (ctx.session.environment === "testing") {
						await tx.insert(productProviderConfigurations).values({
							id: generateId("paymentProviderProduct"),
							productId: newProduct.id,
							projectId: input.projectId,
							providerId: devCheckoutPaymentProviderId,
							providerProductKey: devCheckout.createProductKey({
								productId: newProduct.id,
							}),
							configuration: {
								productId: newProduct.id,
							},
							environment: ctx.session.environment,
							isActive: true,
						});
					}
					return ok({ id: newProduct.id });
				});
			} catch (e) {
				return err(fromUnknownThrow(e));
			}
		}
	);
