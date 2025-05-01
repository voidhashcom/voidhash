import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { VoidhashError } from "@voidhash/lib";
import { z } from "zod";
import { and, eq, perks } from "@voidhash/db";
import { generateId } from "@/lib/id/generate";

export const createPerkInputSchema = z.object({
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
});

export const createPerk = createServiceFunction()
	.input(createPerkInputSchema)
	.function(async ({ input, ctx }) => {
		const authenticatedContext = await authenticateContext(ctx);
		if (!hasProjectPermission(authenticatedContext, input.projectId, "")) {
			throw new VoidhashError({
				code: "FORBIDDEN",
				message: "You are not authorized to create perks",
			});
		}

		const existingPerk = await ctx.db.query.perks.findFirst({
			where: and(
				eq(perks.slug, input.slug),
				eq(perks.projectId, input.projectId)
			),
		});

		if (existingPerk) {
			throw new VoidhashError({
				code: "CONFLICT",
				message:
					"Perk with this slug already exists. Please choose a different slug.",
			});
		}

		const newPerk = {
			id: generateId("perk"),
			slug: input.slug,
			projectId: input.projectId,
			name: input.name,
		};
		await ctx.db.insert(perks).values(newPerk);

		return newPerk;
	});
