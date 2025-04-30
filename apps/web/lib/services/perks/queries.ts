import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { z } from "zod";
import { cache } from "react";
import { getPerkByIdQuery, getPerksQuery } from "./raw-queries";

export const getPerksInputSchema = z.object({
	projectId: z.string(),
});

export const getPerks = cache(
	createServiceFunction()
		.input(getPerksInputSchema)
		.function(async ({ input, ctx }) => {
			const authenticatedContext = await authenticateContext(ctx);
			if (!hasProjectPermission(authenticatedContext, input.projectId, "")) {
				return [];
			}

			const perks = await getPerksQuery(authenticatedContext, input.projectId);
			return perks;
		}).invoke
);

export const getPerkById = cache(
	createServiceFunction()
		.input(z.object({ id: z.string() }))
		.function(async ({ input, ctx }) => {
			const authenticatedContext = await authenticateContext(ctx);
			const perkResult = await getPerkByIdQuery(authenticatedContext, input.id);
			if (!perkResult) {
				return null;
			}

			if (
				!hasProjectPermission(authenticatedContext, perkResult.projectId, "")
			) {
				return null;
			}

			return perkResult;
		}).invoke
);
