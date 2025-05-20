import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { cache } from "react";
import { z } from "zod";
import {
	getCustomerByAppUserIdQuery,
	getCustomerByIdQuery,
	getCustomersQuery,
	getCustomersUnlockedPerksQuery,
} from "./raw-queries";
import { err, ok, Result } from "neverthrow";
import {
	VoidhashForbiddenError,
	VoidhashInternalServerError,
	VoidhashUnauthorizedError,
} from "@voidhash/lib/constants";
import { Customer, CustomerUnlockedPerk } from "@voidhash/db";

type GetCustomersError =
	| VoidhashInternalServerError
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError;

export const getCustomers = cache(
	createServiceFunction()
		.input(
			z.object({
				projectId: z.string(),
				hasAppUserId: z.boolean().optional(),
			})
		)
		.function(
			async ({
				ctx,
				input,
			}): Promise<Result<Customer[], GetCustomersError>> => {
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
					return ok([]);
				}

				return await getCustomersQuery(
					authenticatedContext.value,
					input.projectId,
					{
						hasAppUserId: input.hasAppUserId ?? null,
					}
				);
			}
		).invoke
);

type GetCustomerByIdError =
	| VoidhashInternalServerError
	| VoidhashUnauthorizedError;

export const getCustomerById = cache(
	createServiceFunction()
		.input(z.object({ id: z.string() }))
		.function(
			async ({
				ctx,
				input,
			}): Promise<Result<Customer | null, GetCustomerByIdError>> => {
				const authenticatedContext = await authenticateContext(ctx);

				if (authenticatedContext.isErr()) {
					return err(authenticatedContext.error);
				}

				const customer = await getCustomerByIdQuery(
					authenticatedContext.value,
					input.id
				);
				return customer;
			}
		).invoke
);

type GetCustomerByAppUserIdError =
	| VoidhashInternalServerError
	| VoidhashUnauthorizedError;

export const getCustomerByAppUserId = cache(
	createServiceFunction()
		.input(z.object({ appUserId: z.string() }))
		.function(
			async ({
				ctx,
				input,
			}): Promise<Result<Customer | null, GetCustomerByAppUserIdError>> => {
				const authenticatedContext = await authenticateContext(ctx);

				if (authenticatedContext.isErr()) {
					return err(authenticatedContext.error);
				}

				const customer = await getCustomerByAppUserIdQuery(
					authenticatedContext.value,
					input.appUserId
				);

				if (customer.isErr()) {
					return err(customer.error);
				}

				if (!customer.value) {
					return ok(null);
				}

				if (
					!hasProjectPermission(
						authenticatedContext.value,
						customer.value.projectId,
						"project:all"
					)
				) {
					return ok(null);
				}

				return ok(customer.value);
			}
		).invoke
);

type GetCustomersUnlockedPerksError =
	| VoidhashInternalServerError
	| VoidhashUnauthorizedError;

export const getCustomersUnlockedPerks = cache(
	createServiceFunction()
		.input(z.object({ customerId: z.string() }))
		.function(
			async ({
				ctx,
				input,
			}): Promise<
				Result<CustomerUnlockedPerk[], GetCustomersUnlockedPerksError>
			> => {
				const authenticatedContext = await authenticateContext(ctx);

				if (authenticatedContext.isErr()) {
					return err(authenticatedContext.error);
				}

				const perks = await getCustomersUnlockedPerksQuery(
					authenticatedContext.value,
					input.customerId
				);

				if (perks.isErr()) {
					return err(perks.error);
				}

				return ok(perks.value);
			}
		).invoke
);
