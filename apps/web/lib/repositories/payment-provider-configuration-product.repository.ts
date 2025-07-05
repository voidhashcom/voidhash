import { Db } from "@/lib/effect/db";
import {
	eq,
	and,
	asc,
	not,
	paymentProviderConfigurationProducts,
	paymentProviderConfigurations,
	InsertPaymentProviderConfigurationProduct,
} from "@voidhash/db";
import { Effect } from "effect";
import { EnvironmentValue } from "@voidhash/lib/constants";

export class PaymentProviderConfigurationProductRepository extends Effect.Service<PaymentProviderConfigurationProductRepository>()(
	"PaymentProviderConfigurationProductRepository",
	{
		effect: Effect.gen(function* () {
			const dbService = yield* Db;
			return {
				createPaymentProviderProduct: dbService.makeQuery(
					(
						execute,
						providerProduct: InsertPaymentProviderConfigurationProduct
					) =>
						execute(
							async (db) =>
								await db
									.insert(paymentProviderConfigurationProducts)
									.values(providerProduct)
						)
				),

				updatePaymentProviderProduct: dbService.makeQuery(
					(
						execute,
						{
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
						}
					) =>
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
											eq(
												paymentProviderConfigurationProducts.productId,
												productId
											),
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
					(
						execute,
						{
							productId,
							paymentProviderConfigurationId,
							excludeProviderProductKey,
						}: {
							productId: string;
							paymentProviderConfigurationId: string;
							excludeProviderProductKey?: string;
						}
					) =>
						execute(
							async (db) =>
								await db
									.update(paymentProviderConfigurationProducts)
									.set({ isActive: false })
									.where(
										and(
											eq(
												paymentProviderConfigurationProducts.productId,
												productId
											),
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
					(
						execute,
						{
							productId,
							paymentProviderConfigurationId,
							providerProductKey,
						}: {
							productId: string;
							paymentProviderConfigurationId: string;
							providerProductKey: string;
						}
					) =>
						execute(
							async (db) =>
								await db
									.update(paymentProviderConfigurationProducts)
									.set({ isActive: true })
									.where(
										and(
											eq(
												paymentProviderConfigurationProducts.productId,
												productId
											),
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
					(
						execute,
						{
							productId,
							paymentProviderConfigurationId,
							providerProductKey,
						}: {
							productId: string;
							paymentProviderConfigurationId: string;
							providerProductKey: string;
						}
					) =>
						execute(
							async (db) =>
								await db
									.delete(paymentProviderConfigurationProducts)
									.where(
										and(
											eq(
												paymentProviderConfigurationProducts.productId,
												productId
											),
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
									where: eq(
										paymentProviderConfigurationProducts.productId,
										productId
									),
									orderBy: [
										asc(paymentProviderConfigurationProducts.createdAt),
									],
								})
						)
				),

				getProviderProductById: dbService.makeQuery((execute, id: string) =>
					execute(
						async (db) =>
							await db.query.paymentProviderConfigurationProducts.findFirst({
								where: eq(paymentProviderConfigurationProducts.id, id),
							})
					)
				),

				getProviderProductByPrimaryKey: dbService.makeQuery(
					(
						execute,
						{
							paymentProviderConfigurationId,
							providerProductKey,
							environment,
						}: {
							paymentProviderConfigurationId: string;
							providerProductKey: string;
							environment: EnvironmentValue;
						}
					) =>
						execute(async (db) => {
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
										eq(
											paymentProviderConfigurationProducts.environment,
											environment
										)
									)
								);

							const row = result[0];
							if (!row) return null;

							return {
								...row.payment_provider_configuration_product,
								projectId: row.payment_provider_configuration.projectId,
								providerId: row.payment_provider_configuration.providerId,
							};
						})
				),


			};
		}),

		// Specify dependencies
		dependencies: [Db.Default],
	}
) {}
