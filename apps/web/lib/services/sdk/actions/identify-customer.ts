import { AuthSession } from "@/lib/effect/auth";
import { Environment } from "@/lib/effect/environment";
import { Data, Effect, pipe, Schema } from "effect";
import { generateId } from "@/lib/id/generate";
import { UnauthenticatedError } from "@/lib/effect/errors";
import { mergeCustomers } from "../../customers/merge-customers";
import { ID_BLACKLIST } from "@voidhash/lib/constants/id-blacklist";
import { ANONYMOUS_USER_ID_PREFIX } from "../constants";
import { Db, TransactionContext } from "@/lib/effect/db";
import { CustomerRepository } from "../../customers/customer.repository";
import { Customer } from "@voidhash/db";

export class CustomerConflictError extends Data.TaggedError("CustomerConflictError")<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export class CustomerCreationError extends Data.TaggedError("CustomerCreationError")<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export const identifyCustomerInputSchema = Schema.Struct({
	appUserId: Schema.String.pipe(
		Schema.minLength(5),
		Schema.filter((id) => 
			!ID_BLACKLIST.includes(id) &&
			!id.includes("/") &&
			!id.startsWith(ANONYMOUS_USER_ID_PREFIX),
			{ message: () => "Invalid app user ID" }
		)
	),
	name: Schema.optional(Schema.String),
	email: Schema.optional(Schema.String.pipe(Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))),
});

type IdentifyCustomerInput = Schema.Schema.Type<typeof identifyCustomerInputSchema>;

export const identifyCustomer = (inputUnsafe: IdentifyCustomerInput) =>
	pipe(
		Effect.gen(function* () {
			const session = yield* AuthSession;
			const environment = yield* Environment;
			const customerRepository = yield* CustomerRepository;
			const db = yield* Db;
			
			const input = Schema.decodeUnknownSync(identifyCustomerInputSchema)(
				inputUnsafe
			);

			const projectId = session?.projects[0]?.id;
			if (!projectId) {
				return yield* Effect.fail(
					new UnauthenticatedError({
						message: "Project ID not found after authentication",
					})
				);
			}

			const result = yield* db.transaction((tx) =>
				TransactionContext.provide(tx)(Effect.gen(function* () {
					const currentAppUserId = session?.customer?.appUserId;
					
					// Get current customer if exists
					let currentCustomer: Customer | undefined;
					if (currentAppUserId) {
						currentCustomer = yield* customerRepository.getCustomerByAppUserId({
							appUserId: currentAppUserId,
							environment,
							projectId,
						})
					}

					// Get identifying as customer if exists
					let identifyingAsCustomer = yield* customerRepository.getCustomerByAppUserId({
						appUserId: input.appUserId,
						environment,
						projectId,
					});

					let identifyingAsCustomerId = identifyingAsCustomer?.id ?? null;

					// Can't identify already identified anonymous customer.
					if (
						currentCustomer &&
						currentCustomer.type === "anonymous" &&
						currentCustomer.parentCustomerId
					) {
						const parentCustomer = yield* customerRepository.getCustomerById(currentCustomer.parentCustomerId);
						if (!parentCustomer) return yield* Effect.die(new Error("parentCustomer is null event though it should exist"));
						
						if (parentCustomer.appUserId !== input.appUserId) {
							return yield* Effect.fail(
								new CustomerConflictError({
									message: "Anonymous customer is already identified",
								})
							);
						}

						return parentCustomer;
					}

					// If identifying as customer doesn't exist, create a new one
					if (!identifyingAsCustomer) {
						const newCustomer = {
							id: generateId("customer"),
							projectId,
							appUserId: input.appUserId,
							parentCustomerId: null,
							name: input.name ?? null,
							email: input.email ?? null,
							origin: "ios" as const, // TODO: Make this dynamic
							environment,
							type: "identified" as const,
						};

						yield* customerRepository.createCustomer(newCustomer);
						identifyingAsCustomerId = newCustomer.id;

						identifyingAsCustomer = {
							...newCustomer,
							archivedAt: null,
							createdAt: new Date(),
							updatedAt: new Date(),
							parentCustomerId: null,
						};
					}

					if (!identifyingAsCustomerId) {
						return yield* Effect.fail(
							new CustomerCreationError({
								message: "Failed to identify customer",
							})
						);
					}

					// Merge customers if current customer is anonymous
					if (currentCustomer && currentCustomer.type === "anonymous") {
						yield* mergeCustomers(
							currentCustomer.id,
							identifyingAsCustomerId
						);
					}

					// Get updated identified customer
					const updatedCustomer = yield* customerRepository.getCustomerByAppUserId({
						appUserId: input.appUserId,
						environment,
						projectId,
					});

					if (!updatedCustomer) {
						return yield* Effect.fail(
							new CustomerCreationError({
								message: "Failed to get customer after identification",
							})
						);
					}

					return updatedCustomer;
				}))
			);

			yield* Effect.log(
				`Identified customer ${result.id} for app user ${input.appUserId}`
			);

			return result;
		}),
		Environment.withEnvironment({
			projectId: inputUnsafe.appUserId, // TODO: Get from session context
		}),
		AuthSession.withAuthSession()
	);
