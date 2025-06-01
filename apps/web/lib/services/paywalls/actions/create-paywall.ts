import {
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import {
	fromUnknownThrow,
	VoidhashForbiddenError,
	VoidhashInternalServerError,
	VoidhashUnauthorizedError,
} from "@voidhash/lib";
import { z } from "zod";
import { paywalls } from "@voidhash/db";
import { generateId } from "@/lib/id/generate";
import { err, ok, Result } from "neverthrow";
import { hasEnvironment, isAuthenticated } from "@/lib/middlewares";

export const createPaywallInputSchema = z.object({
	projectId: z.string(),
	name: z
		.string()
		.min(3, "Name must be at least 3 characters long")
		.max(32, "Name must be less than 32 characters"),
});

type CreatePaywallError =
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError
	| VoidhashInternalServerError;

export const createPaywall = createServiceFunction()
	.input(createPaywallInputSchema)
	.use(isAuthenticated)
	.use(hasEnvironment)
	.function(
		async ({
			input,
			ctx,
		}): Promise<Result<{ id: string }, CreatePaywallError>> => {
			if (!hasProjectPermission(ctx, input.projectId, "project:all")) {
				return err({
					code: "FORBIDDEN",
					message: "You are not authorized to create paywalls",
				});
			}

			const newPaywall = {
				id: generateId("paywall"),
				projectId: input.projectId,
				name: input.name,
				environment: ctx.session.environment,
			};
			try {
				await ctx.db.insert(paywalls).values(newPaywall);
				return ok({
					id: newPaywall.id,
				});
			} catch (error) {
				return err(fromUnknownThrow(error));
			}
		}
	);
