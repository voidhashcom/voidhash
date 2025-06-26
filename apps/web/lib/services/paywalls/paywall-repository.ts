import { Db } from "@/lib/effect/db";
import { eq, and, asc, paywalls, paywallProducts } from "@voidhash/db";
import { Effect } from "effect";
import { Environment } from "@voidhash/lib/constants";

export class PaywallRepository extends Effect.Service<PaywallRepository>()(
	"PaywallRepository",
	{
		effect: Effect.gen(function* () {
			const dbService = yield* Db;
			return {
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
			};
		}),

		// Specify dependencies
		dependencies: [Db.Default],
	}
) {}
