import { Db } from "@/lib/effect/db";
import {
	eq,
	and,
	products,
	InsertProduct,
} from "@voidhash/db";
import { Effect } from "effect";
import { EnvironmentValue } from "@voidhash/lib/constants";

export class ProductRepository extends Effect.Service<ProductRepository>()(
	"ProductRepository",
	{
		effect: Effect.gen(function* () {
			const dbService = yield* Db;
			return {
				createProduct: dbService.makeQuery((execute, product: InsertProduct) =>
					execute(async (db) => await db.insert(products).values(product))
				),

				getProducts: dbService.makeQuery(
					(
						execute,
						input: { projectId: string; environment: EnvironmentValue }
					) =>
						execute(
							async (db) =>
								await db.query.products.findMany({
									where: and(
										eq(products.projectId, input.projectId),
										eq(products.environment, input.environment)
									),
								})
						)
				),

				getProductById: dbService.makeQuery((execute, id: string) =>
					execute(
						async (db) =>
							await db.query.products.findFirst({
								where: eq(products.id, id),
							})
					)
				),

				updateProduct: dbService.makeQuery(
					(execute, { id, name }: { id: string; name: string }) =>
						execute(
							async (db) =>
								await db
									.update(products)
									.set({ name, updatedAt: new Date() })
									.where(eq(products.id, id))
						)
				),

				deleteProduct: dbService.makeQuery((execute, id: string) =>
					execute(
						async (db) => await db.delete(products).where(eq(products.id, id))
					)
				),
			};
		}),

		// Specify dependencies
		dependencies: [Db.Default],
	}
) {}
