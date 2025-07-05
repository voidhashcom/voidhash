import { Data, Effect, pipe } from "effect";
import { ProductRepository } from "../repositories/product.repository";
import { AuthSession } from "@/lib/effect/auth";
import { Environment } from "@/lib/effect/environment";
import { checkProjectPermission } from "@/lib/effect/permissions";
import { NotFoundError } from "@/lib/effect/errors";
import { PerkRepository } from "../repositories/perk.repository";
import { ProductPerkRepository } from "../repositories/product-perk.repository";
import { PaymentProviderConfigurationProductRepository } from "../repositories/payment-provider-configuration-product.repository";
import { Db, TransactionContext } from "@/lib/effect/db";
import { paymentProviders } from "@/lib/payment-providers/payment-providers";
import { generateId } from "@/lib/id/generate";
import { devCheckout, devCheckoutPaymentProviderId } from "@/lib/payment-providers/dev-checkout/dev-checkout";
import { Environment as EnvironmentEnum } from "@voidhash/lib/index";

export class ProductNotFound extends Data.TaggedError("ProductNotFound")<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export class PaymentProviderConfigurationNotFound extends Data.TaggedError(
	"PaymentProviderConfigurationNotFound"
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export class PaymentProviderNotFound extends Data.TaggedError(
	"PaymentProviderNotFound"
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export class InvalidConfigurationError extends Data.TaggedError(
	"InvalidConfiguration"
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export class PerkNotFound extends Data.TaggedError("PerkNotFound")<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export class PaymentProviderConfigurationNotFoundError extends Data.TaggedError(
	"PaymentProviderConfigurationNotFound"
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export class ProviderProductNotFound extends Data.TaggedError(
	"ProviderProductNotFound"
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}



export class ProductService extends Effect.Service<ProductService>()(
	"ProductService",
	{
		effect: Effect.gen(function* () {
			const productRepository = yield* ProductRepository;
			const productPerkRepository = yield* ProductPerkRepository;
			const paymentProviderConfigurationProductRepository =
				yield* PaymentProviderConfigurationProductRepository;

			return {
				// Core actions
				createProduct: (input: {
					projectId: string;
					name: string;
				}) =>
					pipe(
						Effect.gen(function* () {
							const session = yield* AuthSession;
							const productRepository = yield* ProductRepository;
							const paymentProviderConfigurationProductRepository = yield* PaymentProviderConfigurationProductRepository;
							const environment = yield* Environment;
							const db = yield* Db;
				
							// SECURITY: Authorization check
							yield* checkProjectPermission(
								input.projectId,
								"project:all",
								`User ${session?.user?.id} is not authorized to create products for project ${input.projectId}`
							);
				
							const productId = generateId("product");
							const newProduct = {
								id: productId,
								projectId: input.projectId,
								name: input.name,
								environment,
							};
				
							yield* db.transaction((tx) =>
								TransactionContext.provide(tx)(
									Effect.gen(function* () {
										// Create the product
										yield* productRepository.createProduct(newProduct);
				
										// For testing environment, create dev checkout configuration
										if (environment === EnvironmentEnum.Testing) {
											const devCheckoutConfig = yield* tx(async (dbTx) => {
												return await dbTx.query.paymentProviderConfigurations.findFirst(
													{
														where: (configs, { eq, and }) =>
															and(
																eq(configs.projectId, input.projectId),
																eq(configs.providerId, devCheckoutPaymentProviderId)
															),
													}
												);
											});
				
											if (!devCheckoutConfig) {
												return yield* Effect.fail(
													new PaymentProviderConfigurationNotFoundError({
														message: "Dev Checkout configuration not found",
													})
												);
											}
				
											yield* paymentProviderConfigurationProductRepository.createPaymentProviderProduct({
												id: generateId("paymentProviderProduct"),
												productId: productId,
												paymentProviderConfigurationId: devCheckoutConfig.id,
												providerProductKey: devCheckout.createProductKey({
													productId: productId,
												}),
												configuration: {
													productId: productId,
												},
												environment,
												isActive: true,
											});
										}
									})
								)
							);
				
							yield* Effect.log(
								`Created product ${productId} for project ${input.projectId}`
							);
				
							return yield* Effect.succeed({ id: productId });
						}),
						Environment.withEnvironment({
							projectId: input.projectId,
						}),
						AuthSession.withAuthSession()
					)
				,
				deleteProduct: (input: {
					productId: string;
				}) =>
					pipe(
						Effect.gen(function* () {
							const session = yield* AuthSession;
							const productRepository = yield* ProductRepository;
				
							// Get the product to check authorization
							const existingProduct = yield* productRepository.getProductById(input.productId);
							if (!existingProduct) {
								return yield* Effect.fail(
									new ProductNotFound({
										message: `Product ${input.productId} not found`,
									})
								);
							}
				
							// SECURITY: Authorization check
							yield* checkProjectPermission(
								existingProduct.projectId,
								"project:all",
								`User ${session?.user?.id} is not authorized to delete product ${input.productId} for project ${existingProduct.projectId}`
							);
				
							yield* productRepository.deleteProduct(input.productId);
				
							yield* Effect.log(
								`Deleted product ${input.productId} for project ${existingProduct.projectId}`
							);
				
							return yield* Effect.succeed(undefined);
						}),
						AuthSession.withAuthSession()
					),
				updateProduct: (input: {
					productId: string;
					name: string;
				}) =>
					pipe(
						Effect.gen(function* () {
							const session = yield* AuthSession;
							const productRepository = yield* ProductRepository;
				
							// Get the product to check authorization
							const existingProduct = yield* productRepository.getProductById(input.productId);
							if (!existingProduct) {
								return yield* Effect.fail(
									new ProductNotFound({
										message: `Product ${input.productId} not found`,
									})
								);
							}
				
							// SECURITY: Authorization check
							yield* checkProjectPermission(
								existingProduct.projectId,
								"project:all",
								`User ${session?.user?.id} is not authorized to update product ${input.productId} for project ${existingProduct.projectId}`
							);
				
							yield* productRepository.updateProduct({
								id: input.productId,
								name: input.name,
							});
				
							yield* Effect.log(
								`Updated product ${input.productId} for project ${existingProduct.projectId}`
							);
				
							return yield* Effect.succeed(undefined);
						}),
						AuthSession.withAuthSession()
					),
				createPaymentProviderProduct: (input: {
					productId: string;
					paymentProviderConfigurationId: string;
					configuration: Record<string, unknown>;
				}) =>
					pipe(
						Effect.gen(function* () {
							const session = yield* AuthSession;
							const productRepository = yield* ProductRepository;
							const environment = yield* Environment;
							const paymentProviderConfigurationProductRepository = yield* PaymentProviderConfigurationProductRepository;
							const db = yield* Db;
				
							// Get product and provider configuration in parallel
							const [product, providerConfiguration] = yield* Effect.all([
								productRepository.getProductById(input.productId),
								db.use(async (dbInstance) => {
									return await dbInstance.query.paymentProviderConfigurations.findFirst(
										{
											where: (configs, { eq }) =>
												eq(configs.id, input.paymentProviderConfigurationId),
										}
									);
								}),
							]);
				
							if (!product) {
								return yield* Effect.fail(
									new ProductNotFound({
										message: `Product ${input.productId} not found`,
									})
								);
							}
				
							if (!providerConfiguration) {
								return yield* Effect.fail(
									new PaymentProviderConfigurationNotFound({
										message: `Payment provider configuration ${input.paymentProviderConfigurationId} not found`,
									})
								);
							}
				
							// SECURITY: Authorization checks
							yield* checkProjectPermission(
								product.projectId,
								"project:all",
								`User ${session?.user?.id} is not authorized to create payment provider products for project ${product.projectId}`
							);
				
							yield* checkProjectPermission(
								providerConfiguration.projectId,
								"project:all",
								`User ${session?.user?.id} is not authorized to access payment provider configuration for project ${providerConfiguration.projectId}`
							);
				
							// Find the payment provider
							const provider = paymentProviders.find(
								(p) => p.getId() === providerConfiguration.providerId
							);
							if (!provider) {
								return yield* Effect.fail(
									new PaymentProviderNotFound({
										message: `Payment provider ${providerConfiguration.providerId} not found`,
									})
								);
							}
				
							// Validate configuration
							const parsedConfiguration = yield* Effect.try({
								try: () =>
									provider.getProductConfigurationSchema().parse(input.configuration),
								catch: (error) =>
									new InvalidConfigurationError({
										message: `Invalid configuration for provider ${providerConfiguration.providerId}: ${error}`,
										cause: error,
									}),
							});
				
							return yield* db.transaction((tx) =>
								TransactionContext.provide(tx)(
									Effect.gen(function* () {
										// Deactivate other provider products for this product
										yield* paymentProviderConfigurationProductRepository.deactivateOtherProviderProducts({
											productId: product.id,
											paymentProviderConfigurationId:
												input.paymentProviderConfigurationId,
										});
				
										// Create new provider product
										const newProviderProduct = {
											id: generateId("paymentProviderProduct"),
											productId: product.id,
											paymentProviderConfigurationId: providerConfiguration.id,
											providerProductKey: provider.createProductKey(
												// eslint-disable-next-line @typescript-eslint/no-explicit-any
												parsedConfiguration as any
											),
											environment,
											configuration: parsedConfiguration,
											isActive: true,
										};
				
										yield* paymentProviderConfigurationProductRepository.createPaymentProviderProduct(
											newProviderProduct
										);
										yield* Effect.log(
											`Created payment provider product ${newProviderProduct.id} for product ${product.id}`
										);
				
										return yield* Effect.succeed(newProviderProduct);
									})
								)
							);
						}),
						Environment.withEnvironment(),
						AuthSession.withAuthSession()
					)
				,
				updatePaymentProviderProduct: (input: {
					productId: string;
					providerProductKey: string;
					paymentProviderConfigurationId: string;
					configuration: Record<string, unknown>;
				}) =>
					pipe(
						Effect.gen(function* () {
							const session = yield* AuthSession;
							const productRepository = yield* ProductRepository;
							const paymentProviderConfigurationProductRepository = yield* PaymentProviderConfigurationProductRepository;
							const environment = yield* Environment;
							const db = yield* Db;
				
							// Get product and provider configuration in parallel
							const [product, providerConfiguration] = yield* Effect.all([
								productRepository.getProductById(input.productId),
								db.use(async (dbInstance) => {
									return await dbInstance.query.paymentProviderConfigurations.findFirst(
										{
											where: (configs, { eq }) =>
												eq(configs.id, input.paymentProviderConfigurationId),
										}
									);
								}),
							]);
				
							if (!product) {
								return yield* Effect.fail(
									new ProductNotFound({
										message: `Product ${input.productId} not found`,
									})
								);
							}
				
							if (!providerConfiguration) {
								return yield* Effect.fail(
									new PaymentProviderConfigurationNotFound({
										message: `Payment provider configuration ${input.paymentProviderConfigurationId} not found`,
									})
								);
							}
				
							// SECURITY: Authorization checks
							yield* checkProjectPermission(
								product.projectId,
								"project:all",
								`User ${session?.user?.id} is not authorized to update payment provider products for project ${product.projectId}`
							);
				
							yield* checkProjectPermission(
								providerConfiguration.projectId,
								"project:all",
								`User ${session?.user?.id} is not authorized to access payment provider configuration for project ${providerConfiguration.projectId}`
							);
				
							// Find the payment provider
							const provider = paymentProviders.find(
								(p) => p.getId() === providerConfiguration.providerId
							);
							if (!provider) {
								return yield* Effect.fail(
									new PaymentProviderNotFound({
										message: `Payment provider ${providerConfiguration.providerId} not found`,
									})
								);
							}
				
							// Validate configuration
							const parsedConfiguration = yield* Effect.try({
								try: () =>
									provider.getProductConfigurationSchema().parse(input.configuration),
								catch: (error) =>
									new InvalidConfigurationError({
										message: `Invalid configuration for provider ${providerConfiguration.providerId}: ${error}`,
										cause: error,
									}),
							});
				
							// Get existing provider product
							const providerProduct =
								yield* paymentProviderConfigurationProductRepository.getProviderProductByPrimaryKey({
									paymentProviderConfigurationId: input.paymentProviderConfigurationId,
									providerProductKey: input.providerProductKey,
									environment,
								});
				
							if (!providerProduct) {
								return yield* Effect.fail(
									new ProviderProductNotFound({
										message: "Provider product not found",
									})
								);
							}
				
							const newProviderProductKey = provider.createProductKey(
								// eslint-disable-next-line @typescript-eslint/no-explicit-any
								parsedConfiguration as any
							);
				
							return yield* db.transaction((tx) =>
								TransactionContext.provide(tx)(
									Effect.gen(function* () {
										yield* paymentProviderConfigurationProductRepository.updatePaymentProviderProduct({
											productId: input.productId,
											paymentProviderConfigurationId:
												input.paymentProviderConfigurationId,
											providerProductKey: input.providerProductKey,
											newProviderProductKey,
											configuration: parsedConfiguration,
										});
				
										yield* Effect.log(
											`Updated payment provider product for product ${input.productId}`
										);
				
										return yield* Effect.succeed(undefined);
									})
								)
							);
						}),
						Environment.withEnvironment(),
						AuthSession.withAuthSession()
					),
				setActivePaymentProviderProduct: (input: {
					productId: string;
					providerProductKey: string;
					paymentProviderConfigurationId: string;
				}) =>
					pipe(
						Effect.gen(function* () {
							const session = yield* AuthSession;
							const productRepository = yield* ProductRepository;
							const paymentProviderConfigurationProductRepository = yield* PaymentProviderConfigurationProductRepository;
							const db = yield* Db;
				
							// Get product and provider configuration in parallel
							const [product, providerConfiguration] = yield* Effect.all([
								productRepository.getProductById(input.productId),
								db.use(async (dbInstance) => {
									return await dbInstance.query.paymentProviderConfigurations.findFirst({
										where: (configs, { eq }) =>
											eq(configs.id, input.paymentProviderConfigurationId),
									});
								}),
							]);
				
							if (!product) {
								return yield* Effect.fail(
									new ProductNotFound({
										message: `Product ${input.productId} not found`,
									})
								);
							}
				
							if (!providerConfiguration) {
								return yield* Effect.fail(
									new PaymentProviderConfigurationNotFound({
										message: `Payment provider configuration ${input.paymentProviderConfigurationId} not found`,
									})
								);
							}
				
							// SECURITY: Authorization checks
							yield* checkProjectPermission(
								product.projectId,
								"project:all",
								`User ${session?.user?.id} is not authorized to update payment provider products for project ${product.projectId}`
							);
				
							yield* checkProjectPermission(
								providerConfiguration.projectId,
								"project:all",
								`User ${session?.user?.id} is not authorized to access payment provider configuration for project ${providerConfiguration.projectId}`
							);
				
							// Find the payment provider
							const provider = paymentProviders.find(
								(p) => p.getId() === providerConfiguration.providerId
							);
							if (!provider) {
								return yield* Effect.fail(
									new PaymentProviderNotFound({
										message: `Payment provider ${providerConfiguration.providerId} not found`,
									})
								);
							}
				
							return yield* db.transaction((tx) =>
								TransactionContext.provide(tx)(Effect.gen(function* () {
									// Deactivate other provider products for this product/configuration
									yield* paymentProviderConfigurationProductRepository.deactivateOtherProviderProducts({
										productId: input.productId,
										paymentProviderConfigurationId: input.paymentProviderConfigurationId,
										excludeProviderProductKey: input.providerProductKey,
									});
				
									// Activate the selected provider product
									yield* paymentProviderConfigurationProductRepository.setActivePaymentProviderProduct({
										productId: input.productId,
										paymentProviderConfigurationId: input.paymentProviderConfigurationId,
										providerProductKey: input.providerProductKey,
									});
				
									yield* Effect.log(
										`Set active payment provider product ${input.providerProductKey} for product ${input.productId}`
									);
				
									return yield* Effect.succeed(undefined);
								}))
							);
						}),
						Environment.withEnvironment(),
						AuthSession.withAuthSession()
					),

				// Query methods
				getProducts: (projectId: string) =>
					pipe(
						Effect.gen(function* () {
							const session = yield* AuthSession;
							const environment = yield* Environment;

							// SECURITY: Authorization check
							yield* checkProjectPermission(
								projectId,
								"project:all",
								`User ${session?.user?.id} is not authorized to access products for project ${projectId}`
							);

							return yield* productRepository.getProducts({
								projectId,
								environment,
							});
						}),
						Environment.withEnvironment({
							projectId,
						}),
						AuthSession.withAuthSession()
					),

				getProductById: (id: string) =>
					pipe(
						Effect.gen(function* () {
							const session = yield* AuthSession;
							const product = yield* productRepository.getProductById(id);
							if (!product) {
								return yield* Effect.fail(
									new NotFoundError({
										message: "Product not found",
									})
								);
							}

							// SECURITY: Authorization check
							yield* checkProjectPermission(
								product.projectId,
								"project:all",
								`User ${session?.user?.id} is not authorized to access product ${id} for project ${product.projectId}`
							);

							return product;
						}),
						AuthSession.withAuthSession()
					),

				// Provider product methods
				getProviderProductsByProductId: (productId: string) =>
					pipe(
						Effect.gen(function* () {
							const session = yield* AuthSession;
							const product =
								yield* productRepository.getProductById(productId);
							if (!product) {
								return yield* Effect.fail(
									new NotFoundError({
										message: "Product not found",
									})
								);
							}

							// SECURITY: Authorization check
							yield* checkProjectPermission(
								product.projectId,
								"project:all",
								`User ${session?.user?.id} is not authorized to access provider products for product ${productId}`
							);

							return yield* paymentProviderConfigurationProductRepository.getProviderProductsByProductId(
								productId
							);
						}),
						AuthSession.withAuthSession()
					),

				getProviderProductByPrimaryKey: ({
					paymentProviderConfigurationId,
					providerProductKey,
				}: {
					paymentProviderConfigurationId: string;
					providerProductKey: string;
				}) =>
					pipe(
						Effect.gen(function* () {
							const session = yield* AuthSession;
							const environment = yield* Environment;

							const providerProduct =
								yield* paymentProviderConfigurationProductRepository.getProviderProductByPrimaryKey(
									{
										paymentProviderConfigurationId,
										providerProductKey,
										environment,
									}
								);

							if (!providerProduct) {
								return yield* Effect.fail(
									new NotFoundError({
										message: "Provider product not found",
									})
								);
							}

							// SECURITY: Authorization check
							yield* checkProjectPermission(
								providerProduct.projectId,
								"project:all",
								`User ${session?.user?.id} is not authorized to access provider product for project ${providerProduct.projectId}`
							);

							return providerProduct;
						}),
						Environment.withEnvironment(),
						AuthSession.withAuthSession()
					),

				// Product perk methods
				getProductPerksByProductId: (productId: string) =>
					pipe(
						Effect.gen(function* () {
							const session = yield* AuthSession;
							const product =
								yield* productRepository.getProductById(productId);
							if (!product) {
								return yield* Effect.fail(
									new NotFoundError({
										message: "Product not found",
									})
								);
							}

							// SECURITY: Authorization check
							yield* checkProjectPermission(
								product.projectId,
								"project:all",
								`User ${session?.user?.id} is not authorized to access product perks for product ${productId}`
							);

							return yield* productPerkRepository.getProductPerksByProductId(
								productId
							);
						}),
						AuthSession.withAuthSession()
					),

				createProductPerk: (input: {
					productId: string;
					perkId: string;
				}) =>
					pipe(
						Effect.gen(function* () {
							const session = yield* AuthSession;
							const productPerkRepository = yield* ProductPerkRepository;
							const perkRepository = yield* PerkRepository;
				
							// Get product to check authorization
							const product = yield* productRepository.getProductById(input.productId);
							if (!product) {
								return yield* Effect.fail(
									new ProductNotFound({
										message: `Product ${input.productId} not found`,
									})
								);
							}
				
							// SECURITY: Authorization check
							yield* checkProjectPermission(
								product.projectId,
								"project:all",
								`User ${session?.user?.id} is not authorized to create product perks for project ${product.projectId}`
							);
				
							// Validate perk exists (this also checks authorization)
							const perk = yield* perkRepository.getPerkById(input.perkId);
							if (!perk) {
								return yield* Effect.fail(
									new PerkNotFound({
										message: `Perk ${input.perkId} not found`,
									})
								);
							}
				
							// SECURITY: Authorization check
							yield* checkProjectPermission(
								perk.projectId,
								"project:all",
								`User ${session?.user?.id} is not authorized to create product perks in project ${product.projectId}`
							);
				
							const newProductPerk = {
								id: generateId("productPerk"),
								productId: input.productId,
								perkId: input.perkId,
							};
				
							yield* productPerkRepository.createProductPerk(newProductPerk);
				
							yield* Effect.log(
								`Created product perk ${newProductPerk.id} for product ${input.productId}`
							);
				
							return yield* Effect.succeed({ id: newProductPerk.id });
						}),
						AuthSession.withAuthSession()
					),
				deleteProductPerk: (input: {
					productId: string;
					perkId: string;
				}) =>
					pipe(
						Effect.gen(function* () {
							const session = yield* AuthSession;
							const productRepository = yield* ProductRepository;
							const productPerkRepository = yield* ProductPerkRepository;
				
							const product = yield* productRepository.getProductById(input.productId);
				
							if (!product) {
								return yield* Effect.fail(
									new ProductNotFound({
										message: `Product ${input.productId} not found`,
									})
								);
							}
				
							// SECURITY: Authorization check
							yield* checkProjectPermission(
								product.projectId,
								"project:all",
								`User ${session?.user?.id} is not authorized to delete product perks for product ${input.productId}`
							);
				
							yield* productPerkRepository.deleteProductPerk({
								productId: input.productId,
								perkId: input.perkId,
							});
				
							yield* Effect.log(
								`Deleted product perk ${input.perkId} from product ${input.productId}`
							);
				
							return yield* Effect.succeed(undefined);
				
							// TODO: Think about deleting already granted perks.
						}),
						AuthSession.withAuthSession()
					),
				deletePaymentProviderProduct: (input: {
					productId: string;
					paymentProviderConfigurationId: string;
					providerProductKey: string;
				}) =>
					pipe(
						Effect.gen(function* () {
							const session = yield* AuthSession;
							const productRepository = yield* ProductRepository;
							const paymentProviderConfigurationProductRepository = yield* PaymentProviderConfigurationProductRepository;
				
							// Get the product to check authorization
							const product = yield* productRepository.getProductById(input.productId);
							if (!product) {
								return yield* Effect.fail(
									new ProductNotFound({
										message: `Product ${input.productId} not found`,
									})
								);
							}
				
							// SECURITY: Authorization check
							yield* checkProjectPermission(
								product.projectId,
								"project:all",
								`User ${session?.user?.id} is not authorized to delete payment provider products for project ${product.projectId}`
							);
				
							yield* paymentProviderConfigurationProductRepository.deletePaymentProviderProduct({
								productId: input.productId,
								paymentProviderConfigurationId: input.paymentProviderConfigurationId,
								providerProductKey: input.providerProductKey,
							});
				
							yield* Effect.log(
								`Deleted payment provider product for product ${input.productId}`
							);
				
							return yield* Effect.succeed(undefined);
						}),
						AuthSession.withAuthSession()
					),
			};
		}),

		// Specify dependencies
		dependencies: [ProductRepository.Default, PerkRepository.Default],
	}
) {}
