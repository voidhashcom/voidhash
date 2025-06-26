import { Effect, pipe } from "effect";
import { CustomerRepository } from "./customer-repository";
import { createCustomer } from "./actions/create-customer";
import { AuthSession } from "@/lib/effect/auth";
import { Environment } from "@/lib/effect/environment";
import { checkProjectPermission } from "@/lib/effect/permissions";
import { NotFoundError } from "@/lib/effect/errors";

export class CustomerService extends Effect.Service<CustomerService>()(
	"CustomerService",
	{
		effect: Effect.gen(function* () {
			const customerRepository = yield* CustomerRepository;
			return {
				createCustomer,
				getCustomers: ({
					projectId,
					type,
				}: {
					projectId: string;
					type?: "identified" | "anonymous";
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
						Environment.withEnvironment(),
						AuthSession.withAuthSession()
					),
			};
		}),

		// Specify dependencies
		dependencies: [CustomerRepository.Default],
	}
) {}
