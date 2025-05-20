import {
	authenticateContext,
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
import { paywallLocations } from "@voidhash/db";
import { getPaywallLocationByIdQuery } from "../raw-queries";
import { eq } from "drizzle-orm";
import { err, ok, Result } from "neverthrow";

export const deletePaywallLocationInputSchema = z.object({
	paywallLocationId: z.string(),
});

type DeletePaywallLocationError =
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError
	| VoidhashInternalServerError
	| VoidhashNotFoundError;

export const deletePaywallLocation = createServiceFunction()
	.input(deletePaywallLocationInputSchema)
	.function(
		async ({
			input,
			ctx,
		}): Promise<Result<void, DeletePaywallLocationError>> => {
			const authenticatedContext = await authenticateContext(ctx);
			if (authenticatedContext.isErr()) {
				return err(authenticatedContext.error);
			}
			const existingPaywallLocation = await getPaywallLocationByIdQuery(
				authenticatedContext.value,
				input.paywallLocationId
			);
			if (existingPaywallLocation.isErr()) {
				return err(existingPaywallLocation.error);
			}
			if (!existingPaywallLocation.value) {
				return err({
					code: "NOT_FOUND",
					message: "Paywall location not found",
					resource: "paywall_location",
					payload: {
						paywallLocationId: input.paywallLocationId,
					},
				});
			}
			if (
				!hasProjectPermission(
					authenticatedContext.value,
					existingPaywallLocation.value.projectId,
					"project:all"
				)
			) {
				return err({
					code: "FORBIDDEN",
					message: "You are not authorized to delete this paywall location",
				});
			}

			try {
				await ctx.db
					.delete(paywallLocations)
					.where(eq(paywallLocations.id, input.paywallLocationId));
				return ok(undefined);
			} catch (e) {
				return err(fromUnknownThrow(e));
			}
		}
	);
