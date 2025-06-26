// import {
// 	createServiceFunction,
// 	hasProjectPermission,
// } from "@/lib/service-function";
// import { z } from "zod";
// import { cache } from "react";
// import {
// 	getPaywallLocationByIdQuery,
// 	getPaywallLocationsQuery,
// } from "./raw-queries";
// import {
// 	VoidhashForbiddenError,
// 	VoidhashInternalServerError,
// 	VoidhashNotFoundError,
// 	VoidhashUnauthorizedError,
// } from "@voidhash/lib/constants";
// import { err, ok, Result } from "neverthrow";
// import { PaywallLocation } from "@voidhash/db";
// import { hasEnvironment, isAuthenticated } from "@/lib/middlewares";

// export const getPaywallLocationsInputSchema = z.object({
// 	projectId: z.string(),
// });

// type GetPaywallLocationsError =
// 	| VoidhashUnauthorizedError
// 	| VoidhashForbiddenError
// 	| VoidhashInternalServerError;

// export const getPaywallLocations = cache(
// 	createServiceFunction()
// 		.input(getPaywallLocationsInputSchema)
// 		.use(isAuthenticated)
// 		.use(hasEnvironment)
// 		.function(
// 			async ({
// 				input,
// 				ctx,
// 			}): Promise<Result<PaywallLocation[], GetPaywallLocationsError>> => {
// 				if (!hasProjectPermission(ctx, input.projectId, "project:all")) {
// 					return err({
// 						code: "FORBIDDEN",
// 						message: "You are not authorized to access this project",
// 					});
// 				}

// 				const paywallLocations = await getPaywallLocationsQuery(
// 					ctx,
// 					input.projectId,
// 					ctx.session.environment
// 				);
// 				return paywallLocations;
// 			}
// 		).invoke
// );

// type GetPaywallLocationByIdError =
// 	| VoidhashUnauthorizedError
// 	| VoidhashForbiddenError
// 	| VoidhashNotFoundError
// 	| VoidhashInternalServerError;

// export const getPaywallLocationById = cache(
// 	createServiceFunction()
// 		.input(z.object({ id: z.string() }))
// 		.use(isAuthenticated)
// 		.function(
// 			async ({
// 				input,
// 				ctx,
// 			}): Promise<Result<PaywallLocation, GetPaywallLocationByIdError>> => {
// 				const paywallLocationResult = await getPaywallLocationByIdQuery(
// 					ctx,
// 					input.id
// 				);
// 				if (paywallLocationResult.isErr()) {
// 					return err(paywallLocationResult.error);
// 				}

// 				if (
// 					!hasProjectPermission(
// 						ctx,
// 						paywallLocationResult.value.projectId,
// 						"project:all"
// 					)
// 				) {
// 					return err({
// 						code: "FORBIDDEN",
// 						message: "You are not authorized to access this project",
// 					});
// 				}

// 				return ok(paywallLocationResult.value);
// 			}
// 		).invoke
// );
