import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { VoidhashError } from "@voidhash/lib";
import { z } from "zod";
import { and, eq, paywallLocations } from "@voidhash/db";
import { generateId } from "@/lib/id/generate";
import { getPaywallByIdQuery } from "../paywalls/raw-queries";

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

export const createPaywallLocation = createServiceFunction()
	.input(createPaywallLocationInputSchema)
	.function(async ({ input, ctx }) => {
		const authenticatedContext = await authenticateContext(ctx);
		if (!hasProjectPermission(authenticatedContext, input.projectId, "")) {
			throw new VoidhashError({
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
			throw new VoidhashError({
				code: "CONFLICT",
				message:
					"Paywall location with this slug already exists. Please choose a different slug.",
			});
		}

		const defaultPaywall = await getPaywallByIdQuery(
			ctx,
			input.defaultPaywallId
		);
		if (!defaultPaywall) {
			throw new VoidhashError({
				code: "NOT_FOUND",
				message: "Default paywall not found",
			});
		}

		const newPaywallLocation = {
			id: generateId("paywallLocation"),
			slug: input.slug,
			projectId: input.projectId,
			name: input.name,
			defaultPaywallId: input.defaultPaywallId,
		};
		await ctx.db.insert(paywallLocations).values(newPaywallLocation);

		return newPaywallLocation;
	});
