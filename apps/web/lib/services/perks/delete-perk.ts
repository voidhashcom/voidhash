import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { VoidhashError } from "@voidhash/lib";
import { z } from "zod";
import { perks } from "@voidhash/db";
import { getPerkByIdQuery } from "./raw-queries";
import { eq } from "drizzle-orm";

export const deletePerkInputSchema = z.object({
	perkId: z.string(),
});

export const deletePerk = createServiceFunction()
	.input(deletePerkInputSchema)
	.function(async ({ input, ctx }) => {
		const authenticatedContext = await authenticateContext(ctx);
		const existingPerk = await getPerkByIdQuery(
			authenticatedContext,
			input.perkId
		);
		if (!existingPerk) {
			throw new VoidhashError({
				code: "NOT_FOUND",
				message: "Perk not found",
			});
		}

		if (
			!hasProjectPermission(authenticatedContext, existingPerk.projectId, "")
		) {
			throw new VoidhashError({
				code: "FORBIDDEN",
				message: "You are not authorized to delete this perk",
			});
		}

		await ctx.db.delete(perks).where(eq(perks.id, input.perkId));
	});
