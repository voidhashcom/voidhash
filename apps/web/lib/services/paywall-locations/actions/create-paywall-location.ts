import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import {
	fromUnknownThrow,
	VoidhashConflictError,
	VoidhashForbiddenError,
	VoidhashInternalServerError,
	VoidhashNotFoundError,
	VoidhashUnauthorizedError,
} from "@voidhash/lib";
import { z } from "zod";
import { and, eq, PaywallLocation, paywallLocations } from "@voidhash/db";
import { generateId } from "@/lib/id/generate";
import { getPaywallByIdQuery } from "../../paywalls/raw-queries";
import { err, ok, Result } from "neverthrow";

export const createPaywallLocationInputSchema = z.object({
	projectId: z.string(),
	name: z
		.string()
		.min(3, "Name must be at least 3 characters long")
		.max(32, "Name must be less than 32 characters"),
	slug: z
		.string()
		.min(3, "Slug must be at least 3 characters long")
		.max(32, "Slug must be less than 32 characters")
		.regex(
			/^[a-z0-9_-]+$/,
			"Slug must contain only lowercase letters, numbers, underscores, and hyphens"
		),
	defaultPaywallId: z.string(),
});

type CreatePaywallLocationError =
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError
	| VoidhashInternalServerError
	| VoidhashNotFoundError
	| VoidhashConflictError;

export const createPaywallLocation = createServiceFunction()
	.input(createPaywallLocationInputSchema)
	.function(
		async ({
			input,
			ctx,
		}): Promise<Result<PaywallLocation, CreatePaywallLocationError>> => {
			const authenticatedContext = await authenticateContext(ctx);
			if (authenticatedContext.isErr()) {
				return err(authenticatedContext.error);
			}

			if (
				!hasProjectPermission(
					authenticatedContext.value,
					input.projectId,
					"project:all"
				)
			) {
				return err({
					code: "FORBIDDEN",
					message: "You are not authorized to create paywall locations",
				});
			}

			const existingPaywallLocation =
				await ctx.db.query.paywallLocations.findFirst({
					where: and(
						eq(paywallLocations.slug, input.slug),
						eq(paywallLocations.projectId, input.projectId)
					),
				});

			if (existingPaywallLocation) {
				return err({
					code: "CONFLICT",
					message:
						"Paywall location with this slug already exists. Please choose a different slug.",
					resource: "paywall_location",
					payload: {
						slug: input.slug,
					},
				});
			}

			const defaultPaywall = await getPaywallByIdQuery(
				ctx,
				input.defaultPaywallId
			);

			if (defaultPaywall.isErr()) {
				return err(defaultPaywall.error);
			}

			if (!defaultPaywall.value) {
				return err({
					code: "NOT_FOUND",
					message: "Default paywall not found",
					resource: "paywall",
					payload: {
						paywallId: input.defaultPaywallId,
					},
				});
			}

			const newPaywallLocation = {
				id: generateId("paywallLocation"),
				slug: input.slug,
				projectId: input.projectId,
				name: input.name,
				defaultPaywallId: input.defaultPaywallId,
			};
			try {
				await ctx.db.insert(paywallLocations).values(newPaywallLocation);
				return ok({
					...newPaywallLocation,
					createdAt: new Date(),
					updatedAt: new Date(),
				});
			} catch (e) {
				return err(fromUnknownThrow(e));
			}
		}
	);
