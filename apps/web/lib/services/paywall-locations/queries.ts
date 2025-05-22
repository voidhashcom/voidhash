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
import {
	VoidhashForbiddenError,
	VoidhashInternalServerError,
	VoidhashNotFoundError,
	VoidhashUnauthorizedError,
} from "@voidhash/lib/constants";
import { err, ok, Result } from "neverthrow";
import { PaywallLocation } from "@voidhash/db";

export const getPaywallLocationsInputSchema = z.object({
	projectId: z.string(),
});

type GetPaywallLocationsError =
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError
	| VoidhashInternalServerError;

export const getPaywallLocations = cache(
	createServiceFunction()
		.input(getPaywallLocationsInputSchema)
		.function(
			async ({
				input,
				ctx,
			}): Promise<Result<PaywallLocation[], GetPaywallLocationsError>> => {
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
						message: "You are not authorized to access this project",
					});
				}

				const paywallLocations = await getPaywallLocationsQuery(
					authenticatedContext.value,
					input.projectId
				);
				return paywallLocations;
			}
		).invoke
);

type GetPaywallLocationByIdError =
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError
	| VoidhashNotFoundError
	| VoidhashInternalServerError;

export const getPaywallLocationById = cache(
	createServiceFunction()
		.input(z.object({ id: z.string() }))
		.function(
			async ({
				input,
				ctx,
			}): Promise<Result<PaywallLocation, GetPaywallLocationByIdError>> => {
				const authenticatedContext = await authenticateContext(ctx);
				if (authenticatedContext.isErr()) {
					return err(authenticatedContext.error);
				}
				const paywallLocationResult = await getPaywallLocationByIdQuery(
					authenticatedContext.value,
					input.id
				);
				if (paywallLocationResult.isErr()) {
					return err(paywallLocationResult.error);
				}

				if (
					!hasProjectPermission(
						authenticatedContext.value,
						paywallLocationResult.value.projectId,
						"project:all"
					)
				) {
					return err({
						code: "FORBIDDEN",
						message: "You are not authorized to access this project",
					});
				}

				return ok(paywallLocationResult.value);
			}
		).invoke
);
