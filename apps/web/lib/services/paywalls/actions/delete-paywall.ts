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
import { paywallLocations, paywallProducts, paywalls } from "@voidhash/db";
import { eq } from "drizzle-orm";
import { err, ok, Result } from "neverthrow";
import { isAuthenticated } from "@/lib/middlewares";
import { getPaywallByIdQuery } from "../raw-queries";

export const deletePaywallInputSchema = z.object({
	paywallId: z.string(),
});

type DeletePaywallError =
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError
	| VoidhashInternalServerError
	| VoidhashBadRequestError
	| VoidhashNotFoundError;

export const deletePaywall = createServiceFunction()
	.input(deletePaywallInputSchema)
	.use(isAuthenticated)
	.function(
		async ({ input, ctx }): Promise<Result<void, DeletePaywallError>> => {
			const existingPaywall = await getPaywallByIdQuery(ctx, input.paywallId);
			if (existingPaywall.isErr()) {
				return err(existingPaywall.error);
			}
			if (
				!hasProjectPermission(
					ctx,
					existingPaywall.value.projectId,
					"project:all"
				)
			) {
				return err({
					code: "FORBIDDEN",
					message: "You are not authorized to delete this paywall",
				});
			}

			try {
				const paywallLocationsWithSameDefaultPaywall =
					await ctx.db.query.paywallLocations.findMany({
						where: eq(paywallLocations.defaultPaywallId, input.paywallId),
					});

				if (paywallLocationsWithSameDefaultPaywall.length > 0) {
					return err({
						code: "BAD_REQUEST",
						message:
							"You cannot delete this paywall, because some paywall locations are still using it. Please update the paywall locations to use a different paywall first, or delete the paywall locations.",
					});
				}

				await ctx.db.transaction(async (tx) => {
					await tx
						.delete(paywallProducts)
						.where(eq(paywallProducts.paywallId, input.paywallId));
					await tx.delete(paywalls).where(eq(paywalls.id, input.paywallId));
				});

				return ok(undefined);
			} catch (error) {
				return err(fromUnknownThrow(error));
			}
		}
	);
