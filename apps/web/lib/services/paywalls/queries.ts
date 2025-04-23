import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { z } from "zod";
import { cache } from "react";
import {
	getPaywallByIdQuery,
	getPaywallProductsQuery,
	getPaywallsQuery,
} from "./raw-queries";

export const getPaywallsInputSchema = z.object({
	projectId: z.string(),
});

export const getPaywalls = cache(
	createServiceFunction()
		.input(getPaywallsInputSchema)
		.function(async ({ input, ctx }) => {
			const authenticatedContext = await authenticateContext(ctx);
			if (!hasProjectPermission(authenticatedContext, input.projectId, "")) {
				return [];
			}

			const paywalls = await getPaywallsQuery(input.projectId);
			return paywalls;
		})
);

export const getPaywallById = cache(
	createServiceFunction()
		.input(z.object({ id: z.string() }))
		.function(async ({ input, ctx }) => {
			const authenticatedContext = await authenticateContext(ctx);
			const paywallResult = await getPaywallByIdQuery(input.id);
			if (!paywallResult) {
				return null;
			}

			if (
				!hasProjectPermission(authenticatedContext, paywallResult.projectId, "")
			) {
				return null;
			}

			return paywallResult;
		})
);

export const getPaywallProducts = cache(
	createServiceFunction()
		.input(z.object({ paywallId: z.string() }))
		.function(async ({ input, ctx }) => {
			const authenticatedContext = await authenticateContext(ctx);
			const paywall = await getPaywallById({
				ctx: authenticatedContext,
				input: { id: input.paywallId },
			});
			if (!paywall) {
				return [];
			}

			if (!hasProjectPermission(authenticatedContext, paywall.projectId, "")) {
				return [];
			}

			return await getPaywallProductsQuery(input.paywallId);
		})
);
