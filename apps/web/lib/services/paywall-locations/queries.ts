import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { z } from "zod";
import { cache } from "react";
import {
	getPaywallLocationByIdQuery,
	getPaywallLocationsQuery,
} from "./raw-queries";

export const getPaywallLocationsInputSchema = z.object({
	projectId: z.string(),
});

export const getPaywallLocations = cache(
	createServiceFunction()
		.input(getPaywallLocationsInputSchema)
		.function(async ({ input, ctx }) => {
			const authenticatedContext = await authenticateContext(ctx);
			if (!hasProjectPermission(authenticatedContext, input.projectId, "")) {
				return [];
			}

			const paywallLocations = await getPaywallLocationsQuery(
				authenticatedContext,
				input.projectId
			);
			return paywallLocations;
		}).invoke
);

export const getPaywallLocationById = cache(
	createServiceFunction()
		.input(z.object({ id: z.string() }))
		.function(async ({ input, ctx }) => {
			const authenticatedContext = await authenticateContext(ctx);
			const paywallLocationResult = await getPaywallLocationByIdQuery(
				authenticatedContext,
				input.id
			);
			if (!paywallLocationResult) {
				return null;
			}

			if (
				!hasProjectPermission(
					authenticatedContext,
					paywallLocationResult.projectId,
					""
				)
			) {
				return null;
			}

			return paywallLocationResult;
		}).invoke
);
