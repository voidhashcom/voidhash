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
import { paywallProducts } from "@voidhash/db";
import { and, eq } from "drizzle-orm";
import { getPaywallById } from "../queries";
import { err, ok, Result } from "neverthrow";

export const deletePaywallProductInputSchema = z.object({
	paywallId: z.string(),
	productId: z.string(),
});

type DeletePaywallProductError =
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError
	| VoidhashInternalServerError
	| VoidhashBadRequestError
	| VoidhashNotFoundError;

export const deletePaywallProduct = createServiceFunction()
	.input(deletePaywallProductInputSchema)
	.function(
		async ({
			input,
			ctx,
		}): Promise<Result<void, DeletePaywallProductError>> => {
			const authenticatedContext = await authenticateContext(ctx);
			if (authenticatedContext.isErr()) {
				return err(authenticatedContext.error);
			}

			const paywall = await getPaywallById({
				ctx: authenticatedContext.value,
				input: { id: input.paywallId },
			});

			if (paywall.isErr()) {
				return err(paywall.error);
			}

			if (!paywall.value) {
				return err({
					code: "NOT_FOUND",
					message: "Paywall with specified id not found",
					resource: "paywall",
					payload: { id: input.paywallId },
				});
			}

			if (
				!hasProjectPermission(
					authenticatedContext.value,
					paywall.value.projectId,
					"project:all"
				)
			) {
				return err({
					code: "FORBIDDEN",
					message: "You are not authorized to remove this product",
				});
			}

			try {
				await ctx.db
					.delete(paywallProducts)
					.where(
						and(
							eq(paywallProducts.productId, input.productId),
							eq(paywallProducts.paywallId, input.paywallId)
						)
					);

				return ok(undefined);
			} catch (error) {
				return err(fromUnknownThrow(error));
			}
		}
	);
