import { AuthSession } from "@/lib/effect/auth";
import { Environment } from "@/lib/effect/environment";
import { Effect, pipe } from "effect";
import { UnauthorizedError, NotFoundError } from "@/lib/effect/errors";
import { isAnonymousId } from "../utils";
import { createAnonymousCustomer } from "../create-anonymous-customer";
import { Db, TransactionContext } from "@/lib/effect/db";
import { CustomerRepository } from "../../customers/customer.repository";
import { CustomerOrigin } from "@voidhash/db";

export const getCustomerOrCreateAnonymous = () =>
	pipe(
		Effect.gen(function* () {
			const session = yield* AuthSession;
			const environment = yield* Environment;
			const customerRepository = yield* CustomerRepository;
			const db = yield* Db;

			const appUserId = session?.customer?.appUserId;
			if (!appUserId) {
				return yield* Effect.fail(
					new UnauthorizedError({
						message: "App user ID not found",
					})
				);
			}

			const projectId = session?.projects[0]?.id;
			if (!projectId) {
				return yield* Effect.fail(
					new NotFoundError({
						message: "Project ID not found after authentication",
					})
				);
			}

			const result = yield* db.transaction((tx) =>
				TransactionContext.provide(tx)(
					Effect.gen(function* () {
						// Try to get existing customer
						const customer = yield* customerRepository.getCustomerByAppUserId({
							appUserId,
							environment,
							projectId,
						});

						if (customer) {
							// Return parent if it exists, otherwise return the customer itself
							if (customer.parentCustomerId) {
								const parentCustomer =
									yield* customerRepository.getCustomerById(
										customer.parentCustomerId
									);
								return parentCustomer;
							}
							return customer;
						}

						// Customer not found, check if we should create anonymous customer
						if (isAnonymousId(appUserId)) {
							const newCustomer = yield* createAnonymousCustomer({
								projectId,
								appUserId,
								origin: CustomerOrigin.IOS, // TODO: Make this dynamic
								environment,
							});
							return newCustomer;
						}

						// Customer not found and not anonymous ID
						return yield* Effect.fail(
							new NotFoundError({
								message: "Customer not found",
							})
						);
					})
				)
			);

			return result;
		}),
		Environment.withEnvironment(),
		AuthSession.withAuthSession()
	);
