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
import { perks } from "@voidhash/db";
import { getPerkByIdQuery } from "../raw-queries";
import { eq } from "drizzle-orm";
import { err, ok, Result } from "neverthrow";

export const deletePerkInputSchema = z.object({
	perkId: z.string(),
});

type DeletePerkError =
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError
	| VoidhashInternalServerError
	| VoidhashNotFoundError;

export const deletePerk = createServiceFunction()
	.input(deletePerkInputSchema)
	.function(async ({ input, ctx }): Promise<Result<void, DeletePerkError>> => {
		const authenticatedContext = await authenticateContext(ctx);
		if (authenticatedContext.isErr()) {
			return err(authenticatedContext.error);
		}

		const existingPerk = await getPerkByIdQuery(
			authenticatedContext.value,
			input.perkId
		);
		if (existingPerk.isErr()) {
			return err(existingPerk.error);
		}

		if (
			!hasProjectPermission(
				authenticatedContext.value,
				existingPerk.value.projectId,
				"project:all"
			)
		) {
			return err({
				code: "FORBIDDEN",
				message: "You are not authorized to delete this perk",
			});
		}

		try {
			await ctx.db.delete(perks).where(eq(perks.id, input.perkId));
			return ok(undefined);
		} catch (error) {
			return err(fromUnknownThrow(error));
		}
	});
