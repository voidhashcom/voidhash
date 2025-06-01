import {
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
import { hasEnvironment, isAuthenticated } from "@/lib/middlewares";

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
		.use(isAuthenticated)
		.use(hasEnvironment)
		.function(
			async ({ input, ctx }): Promise<Result<Perk[], GetPerksError>> => {
				if (!hasProjectPermission(ctx, input.projectId, "project:all")) {
					return err({
						code: "FORBIDDEN",
						message: "No permission to access perks.",
					});
				}

				const perks = await getPerksQuery(
					ctx,
					input.projectId,
					ctx.session.environment
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
		.use(isAuthenticated)
		.function(
			async ({ input, ctx }): Promise<Result<Perk, GetPerkByIdError>> => {
				const perkResult = await getPerkByIdQuery(ctx, input.id);

				if (perkResult.isErr()) {
					return err(perkResult.error);
				}

				if (
					!hasProjectPermission(ctx, perkResult.value.projectId, "project:all")
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
