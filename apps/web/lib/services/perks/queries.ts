import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { z } from "zod";
import { cache } from "react";
import { getPerkByIdQuery, getPerksQuery } from "./raw-queries";
import {
	VoidhashForbiddenError,
	VoidhashInternalServerError,
	VoidhashUnauthorizedError,
	VoidhashNotFoundError,
} from "@voidhash/lib/constants";
import { Perk } from "@voidhash/db";
import { err, ok, Result } from "neverthrow";

export const getPerksInputSchema = z.object({
	projectId: z.string(),
});

type GetPerksError =
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError
	| VoidhashInternalServerError;

export const getPerks = cache(
	createServiceFunction()
		.input(getPerksInputSchema)
		.function(
			async ({ input, ctx }): Promise<Result<Perk[], GetPerksError>> => {
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
						message: "No permission to access perks.",
					});
				}

				const perks = await getPerksQuery(
					authenticatedContext.value,
					input.projectId
				);

				if (perks.isErr()) {
					return err(perks.error);
				}

				return ok(perks.value);
			}
		).invoke
);

type GetPerkByIdError =
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError
	| VoidhashInternalServerError
	| VoidhashNotFoundError;

export const getPerkById = cache(
	createServiceFunction()
		.input(z.object({ id: z.string() }))
		.function(
			async ({ input, ctx }): Promise<Result<Perk, GetPerkByIdError>> => {
				const authenticatedContext = await authenticateContext(ctx);
				if (authenticatedContext.isErr()) {
					return err(authenticatedContext.error);
				}

				const perkResult = await getPerkByIdQuery(
					authenticatedContext.value,
					input.id
				);

				if (perkResult.isErr()) {
					return err(perkResult.error);
				}

				if (
					!hasProjectPermission(
						authenticatedContext.value,
						perkResult.value.projectId,
						"project:all"
					)
				) {
					return err({
						code: "FORBIDDEN",
						message: "No permission to access perk.",
					});
				}

				return ok(perkResult.value);
			}
		).invoke
);
