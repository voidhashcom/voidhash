import { Db } from "@/lib/effect/db";
import {
	and,
	Customer,
	customers,
	customersUnlockedPerks,
	eq,
	externalCustomerIdentifiers,
	InsertCustomer,
} from "@voidhash/db";
import { Environment } from "@voidhash/lib/constants";
import { Effect } from "effect";

export class CustomerRepository extends Effect.Service<CustomerRepository>()(
	"CustomerRepository",
	{
		effect: Effect.gen(function* () {
			const dbService = yield* Db;
			return {
				createCustomer: dbService.makeQuery(
					(execute, customer: InsertCustomer) =>
						execute(async (db) => await db.insert(customers).values(customer))
				),

				getCustomers: dbService.makeQuery(
					(
						execute,
						{
							projectId,
							environment,
							type,
						}: {
							projectId: string;
							environment: Environment;
							type: "identified" | "anonymous" | null;
						}
					) =>
						execute(
							async (db) =>
								await db.query.customers.findMany({
									where: and(
										eq(customers.projectId, projectId),
										type !== null ? eq(customers.type, type) : undefined,
										eq(customers.environment, environment)
									),
								})
						)
				),

				getCustomerById: dbService.makeQuery((execute, id: string) =>
					execute(
						async (db) =>
							await db.query.customers.findFirst({
								where: eq(customers.id, id),
							})
					)
				),

				getCustomerByAppUserId: dbService.makeQuery(
					(
						execute,
						{
							projectId,
							appUserId,
							environment,
						}: {
							projectId: string;
							appUserId: string;
							environment: Environment;
						}
					) =>
						execute(
							async (db) =>
								await db.query.customers.findFirst({
									where: and(
										eq(customers.projectId, projectId),
										eq(customers.appUserId, appUserId),
										eq(customers.environment, environment)
									),
								})
						)
				),

				getCustomerByExternalIdentifier: dbService.makeQuery(
					(
						execute,
						{
							projectId,
							serviceId,
							identifier,
							environment,
						}: {
							projectId: string;
							serviceId: string;
							identifier: string;
							environment: Environment;
						}
					) =>
						execute(
							async (db) =>
								await db
									.select()
									.from(customers)
									.innerJoin(
										externalCustomerIdentifiers,
										eq(customers.id, externalCustomerIdentifiers.customerId)
									)
									.where(
										and(
											eq(customers.projectId, projectId),
											eq(externalCustomerIdentifiers.serviceId, serviceId),
											eq(externalCustomerIdentifiers.identifier, identifier),
											eq(customers.environment, environment)
										)
									)
						)
				),

				getCustomersUnlockedPerks: dbService.makeQuery(
					(execute, customerId: string) =>
						execute(
							async (db) =>
								await db.query.customersUnlockedPerks.findMany({
									where: eq(customersUnlockedPerks.customerId, customerId),
								})
						)
				),

				updateCustomer: dbService.makeQuery(
					(execute, {id, ...customer}: Partial<Customer> & {id: string}) =>
						execute(async (db) => await db.update(customers).set(customer).where(eq(customers.id, id)))
				),
			};
		}),

		// Specify dependencies
		dependencies: [Db.Default],
	}
) {}
