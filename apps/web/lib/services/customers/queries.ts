// import {
// 	createServiceFunction,
// 	hasProjectPermission,
// } from "@/lib/service-function";
// import { cache } from "react";
// import { z } from "zod";
// import {
// 	getCustomerByAppUserIdQuery,
// 	getCustomerByIdQuery,
// 	getCustomersQuery,
// 	getCustomersUnlockedPerksQuery,
// } from "./raw-queries";
// import { err, ok, Result } from "neverthrow";
// import {
// 	VoidhashForbiddenError,
// 	VoidhashInternalServerError,
// 	VoidhashNotFoundError,
// 	VoidhashUnauthorizedError,
// } from "@voidhash/lib/constants";
// import { Customer, CustomerUnlockedPerk } from "@voidhash/db";
// import { hasEnvironment, isAuthenticated } from "@/lib/middlewares";

// type GetCustomersError =
// 	| VoidhashInternalServerError
// 	| VoidhashUnauthorizedError
// 	| VoidhashForbiddenError;

// export type GetCustomersSuccess = Customer[];

// export const getCustomers = cache(
// 	createServiceFunction()
// 		.input(
// 			z.object({
// 				projectId: z.string(),
// 				type: z.enum(["identified", "anonymous"]).optional(),
// 			})
// 		)
// 		.use(isAuthenticated)
// 		.use(hasEnvironment)
// 		.function(
// 			async ({
// 				ctx,
// 				input,
// 			}): Promise<Result<Customer[], GetCustomersError>> => {
// 				if (!hasProjectPermission(ctx, input.projectId, "project:all")) {
// 					return ok([]);
// 				}

// 				return await getCustomersQuery(ctx, input.projectId, {
// 					environment: ctx.session.environment,
// 					type: input.type ?? null,
// 				});
// 			}
// 		).invoke
// );

// type GetCustomerByIdError =
// 	| VoidhashInternalServerError
// 	| VoidhashUnauthorizedError
// 	| VoidhashNotFoundError;

// export const getCustomerById = cache(
// 	createServiceFunction()
// 		.input(z.object({ id: z.string() }))
// 		.use(isAuthenticated)
// 		.function(
// 			async ({
// 				ctx,
// 				input,
// 			}): Promise<Result<Customer, GetCustomerByIdError>> => {
// 				return await getCustomerByIdQuery(ctx, input.id);
// 			}
// 		).invoke
// );

// type GetCustomerByAppUserIdError =
// 	| VoidhashInternalServerError
// 	| VoidhashNotFoundError
// 	| VoidhashForbiddenError
// 	| VoidhashUnauthorizedError;

// export const getCustomerByAppUserId = cache(
// 	createServiceFunction()
// 		.input(z.object({ appUserId: z.string() }))
// 		.use(isAuthenticated)
// 		.use(hasEnvironment)
// 		.function(
// 			async ({
// 				ctx,
// 				input,
// 			}): Promise<Result<Customer, GetCustomerByAppUserIdError>> => {
// 				const customer = await getCustomerByAppUserIdQuery(
// 					ctx,
// 					input.appUserId,
// 					ctx.session.environment
// 				);

// 				if (customer.isErr()) {
// 					return err(customer.error);
// 				}

// 				if (
// 					!hasProjectPermission(ctx, customer.value.projectId, "project:all")
// 				) {
// 					return err({
// 						code: "FORBIDDEN",
// 						message: "Customer not found",
// 					} satisfies VoidhashForbiddenError);
// 				}

// 				return ok(customer.value);
// 			}
// 		).invoke
// );

// type GetCustomersUnlockedPerksError =
// 	| VoidhashInternalServerError
// 	| VoidhashUnauthorizedError;

// export const getCustomersUnlockedPerks = cache(
// 	createServiceFunction()
// 		.input(z.object({ customerId: z.string() }))
// 		.use(isAuthenticated)
// 		.function(
// 			async ({
// 				ctx,
// 				input,
// 			}): Promise<
// 				Result<CustomerUnlockedPerk[], GetCustomersUnlockedPerksError>
// 			> => {
// 				const perks = await getCustomersUnlockedPerksQuery(
// 					ctx,
// 					input.customerId
// 				);

// 				if (perks.isErr()) {
// 					return err(perks.error);
// 				}

// 				return ok(perks.value);
// 			}
// 		).invoke
// );
