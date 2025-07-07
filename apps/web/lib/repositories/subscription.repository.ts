import { Db } from "@/lib/effect/db";
import {
	and,
	customers,
	eq,
	InsertSubscription,
	Subscription,
	subscriptions,
} from "@voidhash/db";
import { Effect } from "effect";

export class SubscriptionRepository extends Effect.Service<SubscriptionRepository>()(
	"SubscriptionRepository",
	{
		effect: Effect.gen(function* () {
			const dbService = yield* Db;
			return {
				createSubscription: dbService.makeQuery(
					(execute, input: InsertSubscription) =>
						execute(async (db) => await db.insert(subscriptions).values(input))
				),
				getSubscriptionById: dbService.makeQuery(
					(execute, id: string) =>
						execute(async (db) => await db.query.subscriptions.findFirst({ where: eq(subscriptions.id, id) }))
				),
				getSubscriptionByStoreSubscriptionId: dbService.makeQuery(
					(
						execute,
						input: {
							storeSubscriptionId: string;
							projectId: string;
						}
					) =>
						execute(
							async (db) =>
								await db
									.select()
									.from(subscriptions)
									.innerJoin(
										customers,
										eq(subscriptions.customerId, customers.id)
									)
									.where(
										and(
											eq(
												subscriptions.storeSubscriptionId,
												input.storeSubscriptionId
											),
											eq(customers.projectId, input.projectId)
										)
									)
						)
				),
				getSubscriptionByInitialTransactionId: dbService.makeQuery(
					(
						execute,
						input: { initialTransactionId: string; projectId: string }
					) =>
						execute(
							async (db) =>
								await db
									.select()
									.from(subscriptions)
									.where(
										and(
											eq(
												subscriptions.initialTransactionId,
												input.initialTransactionId
											),
											eq(subscriptions.customerId, input.projectId)
										)
									)
						)
				),
				getSubscriptionsByCustomerId: dbService.makeQuery(
					(execute, customerId: string) =>
						execute(async (db) => await db.query.subscriptions.findMany({ where: eq(subscriptions.customerId, customerId) }))
				),
				
				getSubscriptionsByCustomerIdWithPaymentProviderConfigurationProduct: dbService.makeQuery(
					(execute, customerId: string) =>
						execute(async (db) => await db.query.subscriptions.findMany({ where: eq(subscriptions.customerId, customerId), with: {
							paymentProviderConfigurationProduct: true
						} }))
				),

				updateSubscription: dbService.makeQuery(
					(execute, input: Omit<Partial<Subscription>, "id"> & { id: string }) =>
						execute(async (db) => await db.update(subscriptions).set(input).where(eq(subscriptions.id, input.id)))
				),
			};
		}),

		// Specify dependencies
		dependencies: [Db.Default],
	}
) {}
