import { createServiceFunction, ServiceContext } from "@/lib/service-function";
import {
	Environment,
	fromUnknownThrow,
	VoidhashConflictError,
	VoidhashInternalServerError,
	VoidhashUnauthorizedError,
} from "@voidhash/lib";
import { z } from "zod";
import { Customer, customers, InsertCustomer } from "@voidhash/db";
import { generateId } from "@/lib/id/generate";
import { err, ok, Result } from "neverthrow";
import { getCustomerWithParentByAppUserIdQuery } from "../raw-queries";
import { mergeCustomers } from "../../customers/merge-customers";
import { ID_BLACKLIST } from "@voidhash/lib/constants/id-blacklist";
import { ANONYMOUS_USER_ID_PREFIX } from "../constants";
import { hasEnvironment, isAuthenticated } from "@/lib/middlewares";

export const identifyCustomerInputSchema = z.object({
	appUserId: z
		.string()
		.min(5)
		.refine((id) => {
			return (
				!ID_BLACKLIST.includes(id) &&
				!id.includes("/") &&
				!id.startsWith(ANONYMOUS_USER_ID_PREFIX)
			);
		}, "Invalid app user ID"),

	name: z.string().optional(),
	email: z.string().email().optional(),
});

type CreateAnonymousCustomerError =
	| VoidhashUnauthorizedError
	| VoidhashConflictError
	| VoidhashInternalServerError;

// | **Session’s current customer** | **`input.appUserId` already exists?** | **Expected behaviour**                                                  |
// | ------------------------------ | ------------------------------------- | ----------------------------------------------------------------------- |
// | `null`                         | no                                    | create new identified customer and return it                            |
// | `null`                         | yes                                   | return existing identified customer                                     |
// | anonymous (un-merged)          | no                                    | create new identified customer, merge anon → new, return identified     |
// | anonymous (un-merged)          | yes                                   | merge anon → existing, return identified                                |
// | anonymous (already merged)     | –                                     | no-op, just return the parent identified customer (idempotent)          |
// | identified                     | same id                               | no-op, return self (idempotent)                                         |
// | identified                     | different id                          | switch user (error)                                                     |

export const identifyCustomer = createServiceFunction()
	.input(identifyCustomerInputSchema)
	.use(isAuthenticated)
	.use(hasEnvironment)
	.function(
		async ({
			input,
			ctx,
		}): Promise<Result<Customer, CreateAnonymousCustomerError>> => {
			try {
				return await ctx.db.transaction(async (tx) => {
					const authenticatedContextWithTx = {
						...ctx,
						tx: tx,
					};
					const projectId = ctx.session?.projects[0]?.id;
					if (!projectId) {
						return err({
							code: "INTERNAL_SERVER_ERROR",
							message: "Project ID not found after authentication",
							originalError: new Error(
								"Project ID not found after authentication"
							),
						} satisfies VoidhashInternalServerError);
					}
					const currentAppUserId = ctx.session?.customer?.appUserId;
					const currentCustomerResult = currentAppUserId
						? (
								await getCustomerWithParentByAppUserIdQuery(
									authenticatedContextWithTx,
									currentAppUserId
								)
							).orElse((e) => {
								if (e.code === "NOT_FOUND") {
									return ok(null);
								}

								return err(e);
							})
						: ok(null);

					if (currentCustomerResult.isErr()) {
						return err(currentCustomerResult.error);
					}

					const identifyingAsCustomerResult = (
						await getCustomerWithParentByAppUserIdQuery(
							authenticatedContextWithTx,
							input.appUserId
						)
					).orElse((e) => {
						if (e.code === "NOT_FOUND") {
							return ok(null);
						}

						return err(e);
					});

					if (identifyingAsCustomerResult.isErr()) {
						return err(identifyingAsCustomerResult.error);
					}

					const identifyingAsCustomer = identifyingAsCustomerResult.value;
					let identifyingAsCustomerId = identifyingAsCustomer?.id ?? null;
					const currentCustomer = currentCustomerResult.value;

					// Can't identify already identified anonymous customer.
					if (
						currentCustomer &&
						currentCustomer.type === "anonymous" &&
						currentCustomer.parentCustomer
					) {
						if (currentCustomer.parentCustomer.appUserId !== input.appUserId) {
							// This is a parented anonymous customer.
							return err({
								code: "CONFLICT",
								message: "Anonymous customer is already identified",
								resource: "customer",
								payload: {
									id: currentCustomer?.id,
									appUserId: input.appUserId,
								},
							} satisfies VoidhashConflictError);
						}

						return ok(currentCustomer.parentCustomer);
					}

					// Identifying as customer is not found -> Create a new, unlinked customer. We link only anonymous customers.
					if (!identifyingAsCustomer) {
						const newCustomer = await createCustomer(
							authenticatedContextWithTx,
							{
								projectId,
								appUserId: input.appUserId,
								parentCustomerId: null,
								name: input.name ?? null,
								email: input.email ?? null,
								origin: "ios", // TODO: Make this dynamic
								environment: ctx.session.environment,
							}
						);

						if (newCustomer.isErr()) {
							return err(newCustomer.error);
						}

						identifyingAsCustomerId = newCustomer.value.id;
					}

					if (!identifyingAsCustomerId) {
						return err({
							code: "INTERNAL_SERVER_ERROR",
							message: "Failed to identify customer",
							originalError: new Error("Failed to identify customer"),
						} satisfies VoidhashInternalServerError);
					}

					// Merge customers if current customer is anonymous.
					if (currentCustomer && currentCustomer.type === "anonymous") {
						const res = await mergeCustomers(
							authenticatedContextWithTx,
							currentCustomer.id,
							identifyingAsCustomerId
						);
						if (res.isErr()) {
							return err(res.error);
						}
					}

					const updatedIdentifiedAsCustomer = (
						await getCustomerWithParentByAppUserIdQuery(
							authenticatedContextWithTx,
							input.appUserId
						)
					).orElse((e) => {
						if (e.code === "NOT_FOUND") {
							return err({
								code: "INTERNAL_SERVER_ERROR",
								message: "Failed to get customer",
								originalError: new Error("Failed to get customer"),
							} satisfies VoidhashInternalServerError);
						}
						return err(e);
					});

					if (updatedIdentifiedAsCustomer.isErr()) {
						return err(updatedIdentifiedAsCustomer.error);
					}

					return ok(updatedIdentifiedAsCustomer.value);
				});
			} catch (error) {
				return err(fromUnknownThrow(error));
			}
		}
	);

async function createCustomer(
	ctx: ServiceContext,
	input: {
		projectId: string;
		appUserId: string;
		parentCustomerId: string | null;
		origin: "ios" | "android";
		name: string | null;
		email: string | null;
		environment: Environment;
	}
): Promise<Result<Customer, CreateAnonymousCustomerError>> {
	const tx = ctx.tx ?? ctx.db;
	const newCustomer = {
		id: generateId("customer"),
		projectId: input.projectId,
		appUserId: input.appUserId,
		name: input.name ?? null,
		email: input.email ?? null,
		origin: "ios", // TODO: Make this dynamic
		type: "identified",
		parentCustomerId: input.parentCustomerId,
		environment: input.environment,
	} satisfies InsertCustomer;

	try {
		await tx.insert(customers).values(newCustomer);
		return ok({
			...newCustomer,
			archivedAt: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		});
	} catch (error) {
		return err({
			code: "INTERNAL_SERVER_ERROR",
			message: "Failed to create customer",
			originalError: error,
		});
	}
}
