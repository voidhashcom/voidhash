import { createServiceFunction } from "@/lib/service-function";
import { type Customer } from "@voidhash/db";
import {
	VoidhashInternalServerError,
	VoidhashNotFoundError,
	VoidhashForbiddenError,
	VoidhashUnauthorizedError,
	fromUnknownThrow,
} from "@voidhash/lib/constants";
import { Result, err, ok } from "neverthrow";
import { getCustomerWithParentByAppUserIdQuery } from "../raw-queries";
import { isAnonymousId } from "../utils";
import { hasEnvironment, isAuthenticated } from "@/lib/middlewares";
import { createAnonymousCustomer } from "../create-anonymous-customer";

type GetOrCreateAnonymousCustomerError =
	| VoidhashInternalServerError
	| VoidhashNotFoundError
	| VoidhashForbiddenError
	| VoidhashUnauthorizedError;

export const sdkGetCustomerOrCreateAnonymous = createServiceFunction()
	.use(isAuthenticated)
	.use(hasEnvironment)
	.function(
		async ({
			ctx,
		}): Promise<Result<Customer, GetOrCreateAnonymousCustomerError>> => {
			const appUserId = ctx.session?.customer?.appUserId;

			if (!appUserId) {
				return err({
					code: "UNAUTHORIZED",
					message: "App user ID not found",
				});
			}

			const projectId = ctx.session?.projects[0]?.id;
			if (!projectId) {
				return err({
					code: "INTERNAL_SERVER_ERROR",
					message: "Project ID not found after authentication",
					originalError: new Error("Project ID not found after authentication"),
				});
			}

			try {
				return await ctx.db.transaction(async (tx) => {
					const customer = await getCustomerWithParentByAppUserIdQuery(
						{
							...ctx,
							tx: tx,
						},
						appUserId,
						ctx.session.environment
					);

					if (customer.isErr()) {
						// When not found, we should check if the id is anonymous. If it is, we should create a new customer.
						if (
							customer.error.code === "NOT_FOUND" &&
							isAnonymousId(appUserId)
						) {
							return createAnonymousCustomer(
								{
									...ctx,
									tx: tx,
								},
								{
									projectId,
									appUserId: appUserId,
									origin: "ios", // TODO: Make this dynamic
									environment: ctx.session.environment,
								}
							);
						}

						return err(customer.error);
					}

					// Return parent, if it exists
					if (customer.value.parentCustomer) {
						return ok(customer.value.parentCustomer);
					}

					return ok(customer.value);
				});
			} catch (e) {
				return err(fromUnknownThrow(e));
			}
		}
	);
