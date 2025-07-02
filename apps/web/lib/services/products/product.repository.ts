import { Db } from "@/lib/effect/db";
import {
	eq,
	and,
	asc,
	not,
	products,
	productPerks,
	paymentProviderConfigurationProducts,
	paymentProviderConfigurations,
	InsertProduct,
	InsertProductPerk,
	InsertPaymentProviderConfigurationProduct,
} from "@voidhash/db";
import { Effect } from "effect";
import { Environment } from "@voidhash/lib/constants";

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
					(execute, input: { projectId: string; environment: Environment }) =>
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
					execute(async (db) => 
						await db.delete(products).where(eq(products.id, id))
					)
				),

				// Provider product methods
				createPaymentProviderProduct: dbService.makeQuery(
					(execute, providerProduct: InsertPaymentProviderConfigurationProduct) =>
						execute(async (db) => 
							await db.insert(paymentProviderConfigurationProducts).values(providerProduct)
						)
				),

				updatePaymentProviderProduct: dbService.makeQuery(
					(execute, {
						productId,
						paymentProviderConfigurationId,
						providerProductKey,
						newProviderProductKey,
						configuration,
					}: {
						productId: string;
						paymentProviderConfigurationId: string;
						providerProductKey: string;
						newProviderProductKey: string;
						configuration: object;
					}) =>
						execute(
							async (db) =>
								await db
									.update(paymentProviderConfigurationProducts)
									.set({
										providerProductKey: newProviderProductKey,
										configuration: configuration,
									})
									.where(
										and(
											eq(paymentProviderConfigurationProducts.productId, productId),
											eq(
												paymentProviderConfigurationProducts.paymentProviderConfigurationId,
												paymentProviderConfigurationId
											),
											eq(
												paymentProviderConfigurationProducts.providerProductKey,
												providerProductKey
											)
										)
									)
						)
				),

				deactivateOtherProviderProducts: dbService.makeQuery(
					(execute, {
						productId,
						paymentProviderConfigurationId,
						excludeProviderProductKey,
					}: {
						productId: string;
						paymentProviderConfigurationId: string;
						excludeProviderProductKey?: string;
					}) =>
						execute(
							async (db) =>
								await db
									.update(paymentProviderConfigurationProducts)
									.set({ isActive: false })
									.where(
										and(
											eq(paymentProviderConfigurationProducts.productId, productId),
											eq(
												paymentProviderConfigurationProducts.paymentProviderConfigurationId,
												paymentProviderConfigurationId
											),
											excludeProviderProductKey
												? not(
														eq(
															paymentProviderConfigurationProducts.providerProductKey,
															excludeProviderProductKey
														)
												  )
												: undefined
										)
									)
						)
				),

				setActivePaymentProviderProduct: dbService.makeQuery(
					(execute, {
						productId,
						paymentProviderConfigurationId,
						providerProductKey,
					}: {
						productId: string;
						paymentProviderConfigurationId: string;
						providerProductKey: string;
					}) =>
						execute(
							async (db) =>
								await db
									.update(paymentProviderConfigurationProducts)
									.set({ isActive: true })
									.where(
										and(
											eq(paymentProviderConfigurationProducts.productId, productId),
											eq(
												paymentProviderConfigurationProducts.paymentProviderConfigurationId,
												paymentProviderConfigurationId
											),
											eq(
												paymentProviderConfigurationProducts.providerProductKey,
												providerProductKey
											)
										)
									)
						)
				),

				deletePaymentProviderProduct: dbService.makeQuery(
					(execute, {
						productId,
						paymentProviderConfigurationId,
						providerProductKey,
					}: {
						productId: string;
						paymentProviderConfigurationId: string;
						providerProductKey: string;
					}) =>
						execute(
							async (db) =>
								await db
									.delete(paymentProviderConfigurationProducts)
									.where(
										and(
											eq(paymentProviderConfigurationProducts.productId, productId),
											eq(
												paymentProviderConfigurationProducts.paymentProviderConfigurationId,
												paymentProviderConfigurationId
											),
											eq(
												paymentProviderConfigurationProducts.providerProductKey,
												providerProductKey
											)
										)
									)
						)
				),

				getProviderProductsByProductId: dbService.makeQuery(
					(execute, productId: string) =>
						execute(
							async (db) =>
								await db.query.paymentProviderConfigurationProducts.findMany({
									where: eq(paymentProviderConfigurationProducts.productId, productId),
									orderBy: [asc(paymentProviderConfigurationProducts.createdAt)],
								})
						)
				),

                getProviderProductById: dbService.makeQuery(
                    (execute, id: string) =>
                        execute(
                            async (db) =>
                                await db.query.paymentProviderConfigurationProducts.findFirst({
                                    where: eq(paymentProviderConfigurationProducts.id, id),
                                })
                        )
                ),

				getProviderProductByPrimaryKey: dbService.makeQuery(
					(execute, {
						paymentProviderConfigurationId,
						providerProductKey,
						environment,
					}: {
						paymentProviderConfigurationId: string;
						providerProductKey: string;
						environment: Environment;
					}) =>
						execute(
							async (db) => {
								const result = await db
									.select()
									.from(paymentProviderConfigurationProducts)
									.innerJoin(
										paymentProviderConfigurations,
										eq(
											paymentProviderConfigurationProducts.paymentProviderConfigurationId,
											paymentProviderConfigurations.id
										)
									)
									.where(
										and(
											eq(
												paymentProviderConfigurationProducts.paymentProviderConfigurationId,
												paymentProviderConfigurationId
											),
											eq(
												paymentProviderConfigurationProducts.providerProductKey,
												providerProductKey
											),
											eq(paymentProviderConfigurationProducts.environment, environment)
										)
									);

								const row = result[0];
								if (!row) return null;

								return {
									...row.payment_provider_configuration_product,
									projectId: row.payment_provider_configuration.projectId,
									providerId: row.payment_provider_configuration.providerId,
								};
							}
						)
				),

				// Product perk methods
				createProductPerk: dbService.makeQuery(
					(execute, productPerk: InsertProductPerk) =>
						execute(async (db) => 
							await db.insert(productPerks).values(productPerk)
						)
				),

				getProductPerksByProductId: dbService.makeQuery(
					(execute, productId: string) =>
						execute(
							async (db) =>
								await db.query.productPerks.findMany({
									where: eq(productPerks.productId, productId),
									orderBy: [asc(productPerks.createdAt)],
								})
						)
				),

				deleteProductPerk: dbService.makeQuery(
					(execute, { productId, perkId }: { productId: string; perkId: string }) =>
						execute(
							async (db) =>
								await db
									.delete(productPerks)
									.where(
										and(
											eq(productPerks.productId, productId),
											eq(productPerks.perkId, perkId)
										)
									)
						)
				),
			};
		}),

		// Specify dependencies
		dependencies: [Db.Default],
	}
) {}
