import { Effect, pipe } from "effect";
import { CustomerRepository } from "../repositories/customer.repository";
import { AuthSession } from "@/lib/effect/auth";
import { Environment } from "@/lib/effect/environment";
import { checkProjectPermission } from "@/lib/effect/permissions";
import { NotFoundError } from "@/lib/effect/errors";
import { CustomerOriginValue, CustomerType, CustomerTypeValue, InsertCustomer } from "@voidhash/db";
import { generateId } from "@/lib/id/generate";
import { EnvironmentValue } from "@voidhash/lib/index";

export class CustomerService extends Effect.Service<CustomerService>()(
	"CustomerService",
	{
		effect: Effect.gen(function* () {
			const customerRepository = yield* CustomerRepository;
			return {
				createCustomer: (input: {
					projectId: string;
					appUserId: string;
					name?: string | null;
					email?: string | null;
					origin: CustomerOriginValue;
				}) =>
					pipe(
						Effect.gen(function* () {
							const session = yield* AuthSession;
							const environment = yield* Environment;
							const customerRepository = yield* CustomerRepository;
				
							// SECURITY: Authorization check
							yield* checkProjectPermission(
								input.projectId,
								"project:all",
								`User ${session?.user?.id} is not authorized to create customers for project ${input.projectId}`
							);
				
							const newCustomer = {
								id: generateId("customer"),
								projectId: input.projectId,
								appUserId: input.appUserId,
								type: CustomerType.Identified,
								name: input.name ?? null,
								email: input.email ?? null,
								parentCustomerId: null,
								origin: input.origin,
								environment: environment,
							} satisfies InsertCustomer;
				
							yield* customerRepository.createCustomer(newCustomer);
							return {
								...newCustomer,
								createdAt: new Date(),
								updatedAt: new Date(),
							};
						}),
						Environment.withEnvironment({
							projectId: input.projectId,
						}),
						AuthSession.withAuthSession()
					),

				createAnonymousCustomer: (
						input: {
							projectId: string;
							appUserId: string;
							origin: CustomerOriginValue;
							environment: EnvironmentValue;
						}
					) =>
						pipe(
							Effect.gen(function* () {
								const customerRepository = yield* CustomerRepository;
						
					
								const newCustomer = {
									id: generateId("customer"),
									type: CustomerType.Anonymous,
									parentCustomerId: null,
									projectId: input.projectId,
									appUserId: input.appUserId,
									origin: input.origin,
									environment: input.environment,
									name: null,
									email: null,
								} satisfies InsertCustomer;
					
								yield* customerRepository.createCustomer(newCustomer);
					
								yield* Effect.log(
									`Created anonymous customer ${newCustomer.id} for app user ${input.appUserId}`
								);
					
								return yield* Effect.succeed({
									...newCustomer,
									archivedAt: null,
									createdAt: new Date(),
									updatedAt: new Date(),
								});
							})
						),
					
				mergeCustomers: (fromCustomerId: string, toCustomerId: string) =>
						Effect.gen(function* () {
							const customerRepository = yield* CustomerRepository;
							return yield* customerRepository.updateCustomer({
								id: fromCustomerId,
								parentCustomerId: toCustomerId,
								archivedAt: new Date(),
							});
						}),
				getCustomers: ({
					projectId,
					type,
				}: {
					projectId: string;
					type?: CustomerTypeValue;
				}) =>
					pipe(
						Effect.gen(function* () {
							const session = yield* AuthSession;
							const environment = yield* Environment;
							yield* checkProjectPermission(
								projectId,
								"project:all",
								`User ${session?.user?.id} is not authorized to access customers for project ${projectId}`
							);
							return yield* customerRepository.getCustomers({
								projectId,
								environment,
								type: type ?? null,
							});
						}),
						Environment.withEnvironment({
							projectId,
						}),
						AuthSession.withAuthSession()
					),

				getCustomerById: (id: string) =>
					pipe(
						Effect.gen(function* () {
							const session = yield* AuthSession;
							const customer = yield* customerRepository.getCustomerById(id);
							if (!customer) {
								return yield* Effect.fail(
									new NotFoundError({
										message: "Customer not found",
									})
								);
							}
							yield* checkProjectPermission(
								customer.projectId,
								"project:all",
								`User ${session?.user?.id} is not authorized to access customer ${id} for project ${customer.projectId}`
							);
							return customer;
						}),
						Environment.withEnvironment(),
						AuthSession.withAuthSession()
					),

				getCustomerByAppUserId: (appUserId: string) =>
					pipe(
						Effect.gen(function* () {
							const environment = yield* Environment;
							const session = yield* AuthSession;
							const projectId = session?.projects[0]?.id;
							if (!projectId) {
								return yield* Effect.fail(
									new NotFoundError({
										message: "Project not found",
									})
								);
							}
							const customer = yield* customerRepository.getCustomerByAppUserId(
								{
									projectId,
									appUserId,
									environment,
								}
							);
							if (!customer) {
								return yield* Effect.fail(
									new NotFoundError({
										message: "Customer not found",
									})
								);
							}
							yield* checkProjectPermission(
								customer.projectId,
								"project:all",
								`User ${session?.user?.id} is not authorized to access customer ${appUserId} for project ${customer.projectId}`
							);
							return customer;
						}),
						Environment.withEnvironment(),
						AuthSession.withAuthSession()
					),

				getCustomersUnlockedPerks: (customerId: string) =>
					pipe(
						Effect.gen(function* () {
							const session = yield* AuthSession;
							const [customer, perks] = yield* Effect.all([
								customerRepository.getCustomerById(customerId),
								customerRepository.getCustomersUnlockedPerks(customerId),
							]);
							if (!customer) {
								return yield* Effect.fail(
									new NotFoundError({
										message: "Customer not found",
									})
								);
							}
							yield* checkProjectPermission(
								customer.projectId,
								"project:all",
								`User ${session?.user?.id} is not authorized to access customer ${customerId} for project ${customer.projectId}`
							);
							return perks;
						}),
						AuthSession.withAuthSession()
					),

				getCustomerPurchases: (customerId: string) =>
					pipe(
						Effect.gen(function* () {
							const session = yield* AuthSession;
							const customer =
								yield* customerRepository.getCustomerById(customerId);
							if (!customer) {
								return yield* Effect.fail(
									new NotFoundError({
										message: "Customer not found",
									})
								);
							}
							yield* checkProjectPermission(
								customer.projectId,
								"project:all",
								`User ${session?.user?.id} is not authorized to access customer ${customerId} for project ${customer.projectId}`
							);
							return yield* customerRepository.getCustomerPurchases(customerId);
						}),
						AuthSession.withAuthSession()
					),
			};
		}),

		// Specify dependencies
		dependencies: [CustomerRepository.Default],
	}
) {}
