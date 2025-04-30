import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { VoidhashError } from "@voidhash/lib";
import { z } from "zod";
import { perks } from "@voidhash/db";
import { generateId } from "@/lib/id/generate";

export const createPerkInputSchema = z.object({
	projectId: z.string(),
	name: z
		.string()
		.min(3, "Name must be at least 3 characters long")
		.max(32, "Name must be less than 32 characters"),
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

		const newPerk = {
			id: generateId("perk"),
			projectId: input.projectId,
			name: input.name,
		};
		await ctx.db.insert(perks).values(newPerk);

		return newPerk;
	});
