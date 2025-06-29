import { Db } from "@/lib/effect/db";
import { eq, and, asc, paywalls, paywallProducts, InsertPaywall, InsertPaywallProduct, paywallLocations, inArray, products } from "@voidhash/db";
import { Effect } from "effect";
import { Environment } from "@voidhash/lib/constants";

export class PaywallRepository extends Effect.Service<PaywallRepository>()(
	"PaywallRepository",
	{
		effect: Effect.gen(function* () {
			const dbService = yield* Db;
			return {
				createPaywall: dbService.makeQuery((execute, paywall: InsertPaywall) =>
					execute(async (db) => await db.insert(paywalls).values(paywall))
				),

				getPaywallById: dbService.makeQuery((execute, id: string) =>
					execute(
						async (db) =>
							await db.query.paywalls.findFirst({
								where: eq(paywalls.id, id),
							})
					)
				),

				getPaywalls: dbService.makeQuery(
					(execute, input: { projectId: string; environment: Environment }) =>
						execute(
							async (db) =>
								await db.query.paywalls.findMany({
									where: and(
										eq(paywalls.projectId, input.projectId),
										eq(paywalls.environment, input.environment)
									),
								})
						)
				),

				updatePaywall: dbService.makeQuery(
					(execute, { id, name }: { id: string; name: string }) =>
						execute(
							async (db) =>
								await db.update(paywalls).set({ 
									name, 
									updatedAt: new Date() 
								}).where(eq(paywalls.id, id))
						)
				),

				deletePaywall: dbService.makeQuery((execute, id: string) =>
					execute(async (db) => 
						await db.delete(paywalls).where(eq(paywalls.id, id))
					)
				),

				getPaywallProducts: dbService.makeQuery((execute, paywallId: string) =>
					execute(
						async (db) =>
							await db.query.paywallProducts.findMany({
								where: eq(paywallProducts.paywallId, paywallId),
								with: {
									product: {
										columns: {
											name: true,
										},
									},
								},
								orderBy: [asc(paywallProducts.order)],
							})
					)
				),

				createPaywallProduct: dbService.makeQuery((execute, paywallProduct: InsertPaywallProduct) =>
					execute(async (db) => await db.insert(paywallProducts).values(paywallProduct))
				),

				deletePaywallProducts: dbService.makeQuery((execute, paywallId: string) =>
					execute(async (db) =>
						await db.delete(paywallProducts).where(eq(paywallProducts.paywallId, paywallId))
					)
				),

				getPaywallLocationsUsingPaywall: dbService.makeQuery((execute, paywallId: string) =>
					execute(async (db) =>
						await db.query.paywallLocations.findMany({
							where: eq(paywallLocations.defaultPaywallId, paywallId),
						})
					)
				),

				getProductsWithConfigurations: dbService.makeQuery((execute, productIds: string[]) =>
					execute(async (db) =>
						await db.query.products.findMany({
							where: inArray(products.id, productIds),
							with: {
								paymentProviderConfigurationProducts: true,
							},
						})
					)
				),
			};
		}),

		// Specify dependencies
		dependencies: [Db.Default],
	}
) {}
