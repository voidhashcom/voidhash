import { Data, Effect } from 'effect';
import { Db, TransactionContext } from '@/lib/effect/db';
import { NotFoundError } from '@/lib/effect/errors';
import { checkProjectPermission } from '@/lib/effect/permissions';
import { generateId } from '@/lib/id/generate';
import { paymentProviders } from '@/lib/payment-providers/payment-providers';
import { AuthSession } from '@/lib/services/auth.service';
import { Environment } from '@/lib/services/environment.service';
import { PaymentProviderConfigurationRepository } from '../repositories/payment-provider.repository';
import { PaymentProviderConfigurationProductRepository } from '../repositories/payment-provider-configuration-product.repository';
import { PerkRepository } from '../repositories/perk.repository';
import { ProductRepository } from '../repositories/product.repository';
import { ProductPerkRepository } from '../repositories/product-perk.repository';

export class ProductNotFound extends Data.TaggedError('ProductNotFound')<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class PaymentProviderConfigurationNotFound extends Data.TaggedError(
  'PaymentProviderConfigurationNotFound'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class PaymentProviderNotFound extends Data.TaggedError(
  'PaymentProviderNotFound'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class InvalidConfigurationError extends Data.TaggedError(
  'InvalidConfiguration'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class PerkNotFound extends Data.TaggedError('PerkNotFound')<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class PaymentProviderConfigurationNotFoundError extends Data.TaggedError(
  'PaymentProviderConfigurationNotFound'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class ProviderProductNotFound extends Data.TaggedError(
  'ProviderProductNotFound'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class ProductService extends Effect.Service<ProductService>()(
  'ProductService',
  {
    dependencies: [
      ProductRepository.Default,
      ProductPerkRepository.Default,
      PaymentProviderConfigurationProductRepository.Default
    ],
    effect: Effect.gen(function* () {
      const productRepository = yield* ProductRepository;
      const productPerkRepository = yield* ProductPerkRepository;
      const paymentProviderConfigurationProductRepository =
        yield* PaymentProviderConfigurationProductRepository;

      return {
        // Core actions
        createProduct: (input: { projectId: string; name: string }) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const productRepository = yield* ProductRepository;
            const environment = yield* Environment;
            const db = yield* Db;

            // SECURITY: Authorization check
            yield* checkProjectPermission(
              input.projectId,
              'project:all',
              `User ${session?.user?.id} is not authorized to create products for project ${input.projectId}`
            );

            const productId = generateId('product');
            const newProduct = {
              id: productId,
              projectId: input.projectId,
              name: input.name,
              environment
            };

            yield* db.transaction((tx) =>
              TransactionContext.provide(tx)(
                Effect.gen(function* () {
                  // Create the product
                  yield* productRepository.createProduct(newProduct);
                })
              )
            );

            yield* Effect.log(
              `Created product ${productId} for project ${input.projectId}`
            );

            return yield* Effect.succeed({ id: productId });
          }),

        deleteProduct: (input: { productId: string }) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const productRepository = yield* ProductRepository;

            // Get the product to check authorization
            const existingProduct = yield* productRepository.getProductById(
              input.productId
            );
            if (!existingProduct) {
              return yield* Effect.fail(
                new ProductNotFound({
                  message: `Product ${input.productId} not found`
                })
              );
            }

            // SECURITY: Authorization check
            yield* checkProjectPermission(
              existingProduct.projectId,
              'project:all',
              `User ${session?.user?.id} is not authorized to delete product ${input.productId} for project ${existingProduct.projectId}`
            );

            yield* productRepository.deleteProduct(input.productId);

            yield* Effect.log(
              `Deleted product ${input.productId} for project ${existingProduct.projectId}`
            );

            return yield* Effect.succeed(undefined);
          }),

        updateProduct: (input: { productId: string; name: string }) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const productRepository = yield* ProductRepository;

            // Get the product to check authorization
            const existingProduct = yield* productRepository.getProductById(
              input.productId
            );
            if (!existingProduct) {
              return yield* Effect.fail(
                new ProductNotFound({
                  message: `Product ${input.productId} not found`
                })
              );
            }

            // SECURITY: Authorization check
            yield* checkProjectPermission(
              existingProduct.projectId,
              'project:all',
              `User ${session?.user?.id} is not authorized to update product ${input.productId} for project ${existingProduct.projectId}`
            );

            yield* productRepository.updateProduct({
              id: input.productId,
              name: input.name
            });

            yield* Effect.log(
              `Updated product ${input.productId} for project ${existingProduct.projectId}`
            );

            return yield* Effect.succeed(undefined);
          }),

        createPaymentProviderProduct: (input: {
          productId: string;
          paymentProviderConfigurationId: string;
          configuration: Record<string, unknown>;
        }) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const productRepository = yield* ProductRepository;
            const paymentProviderConfigurationProductRepository =
              yield* PaymentProviderConfigurationProductRepository;
            const db = yield* Db;

            // Get product and provider configuration in parallel
            const [product, providerConfiguration] = yield* Effect.all(
              [
                productRepository.getProductById(input.productId),
                db.use(async (dbInstance) => {
                  return await dbInstance.query.paymentProviderConfigurations.findFirst(
                    {
                      where: (configs, { eq }) =>
                        eq(configs.id, input.paymentProviderConfigurationId)
                    }
                  );
                })
              ],
              {
                concurrency: 'unbounded'
              }
            );

            if (!product) {
              return yield* Effect.fail(
                new ProductNotFound({
                  message: `Product ${input.productId} not found`
                })
              );
            }

            if (!providerConfiguration) {
              return yield* Effect.fail(
                new PaymentProviderConfigurationNotFound({
                  message: `Payment provider configuration ${input.paymentProviderConfigurationId} not found`
                })
              );
            }

            // SECURITY: Authorization checks
            yield* checkProjectPermission(
              product.projectId,
              'project:all',
              `User ${session?.user?.id} is not authorized to create payment provider products for project ${product.projectId}`
            );

            yield* checkProjectPermission(
              providerConfiguration.projectId,
              'project:all',
              `User ${session?.user?.id} is not authorized to access payment provider configuration for project ${providerConfiguration.projectId}`
            );

            // Find the payment provider
            const provider = paymentProviders.find(
              (p) => p.getId() === providerConfiguration.providerId
            );
            if (!provider) {
              return yield* Effect.fail(
                new PaymentProviderNotFound({
                  message: `Payment provider ${providerConfiguration.providerId} not found`
                })
              );
            }

            // Validate configuration
            const parsedConfiguration = yield* Effect.try({
              try: () =>
                provider
                  .getProductConfigurationSchema()
                  .parse(input.configuration),
              catch: (error) =>
                new InvalidConfigurationError({
                  message: `Invalid configuration for provider ${providerConfiguration.providerId}: ${error}`,
                  cause: error
                })
            });

            return yield* db.transaction((tx) =>
              TransactionContext.provide(tx)(
                Effect.gen(function* () {
                  // Deactivate other provider products for this product
                  yield* paymentProviderConfigurationProductRepository.deactivateOtherProviderProducts(
                    {
                      productId: product.id,
                      paymentProviderConfigurationId:
                        input.paymentProviderConfigurationId
                    }
                  );

                  // Create new provider product
                  const newProviderProduct = {
                    id: generateId('paymentProviderProduct'),
                    productId: product.id,
                    paymentProviderConfigurationId: providerConfiguration.id,
                    providerProductKey: provider.createProductKey(
                      // biome-ignore lint/suspicious/noExplicitAny: it is dynamic TODO: Improve
                      parsedConfiguration as any
                    ),
                    environment: product.environment,
                    configuration: parsedConfiguration,
                    isActive: true
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

        updatePaymentProviderProduct: (input: {
          // productId: string;
          // providerProductKey: string;
          // paymentProviderConfigurationId: string;
          paymentProviderConfigurationProductId: string;
          configuration: Record<string, unknown>;
        }) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const productRepository = yield* ProductRepository;
            const paymentProviderConfigurationProductRepository =
              yield* PaymentProviderConfigurationProductRepository;
            const paymentProviderConfigurationRepository =
              yield* PaymentProviderConfigurationRepository;
            const db = yield* Db;

            const providerProduct =
              yield* paymentProviderConfigurationProductRepository.getProviderProductById(
                input.paymentProviderConfigurationProductId
              );

            if (!providerProduct) {
              return yield* Effect.fail(
                new ProviderProductNotFound({
                  message: 'Provider product not found'
                })
              );
            }

            // Get product and provider configuration in parallel
            const [product, providerConfiguration] = yield* Effect.all([
              productRepository.getProductById(providerProduct.productId),
              paymentProviderConfigurationRepository.getPaymentProviderConfigurationById(
                providerProduct.paymentProviderConfigurationId
              )
            ]);

            if (!product) {
              return yield* Effect.fail(
                new ProductNotFound({
                  message: `Product ${providerProduct.productId} not found`
                })
              );
            }

            if (!providerConfiguration) {
              return yield* Effect.fail(
                new PaymentProviderConfigurationNotFound({
                  message: `Payment provider configuration ${providerProduct.paymentProviderConfigurationId} not found`
                })
              );
            }

            // SECURITY: Authorization checks
            yield* checkProjectPermission(
              product.projectId,
              'project:all',
              `User ${session?.user?.id} is not authorized to update payment provider products for project ${product.projectId}`
            );

            // Find the payment provider
            const provider = paymentProviders.find(
              (p) => p.getId() === providerConfiguration.providerId
            );
            if (!provider) {
              return yield* Effect.fail(
                new PaymentProviderNotFound({
                  message: `Payment provider ${providerProduct.paymentProviderConfigurationId} not found`
                })
              );
            }

            // Validate configuration
            const parsedConfiguration = yield* Effect.try({
              try: () =>
                provider
                  .getProductConfigurationSchema()
                  .parse(input.configuration),
              catch: (error) =>
                new InvalidConfigurationError({
                  message: `Invalid configuration for provider ${providerProduct.paymentProviderConfigurationId}: ${error}`,
                  cause: error
                })
            });

            const newProviderProductKey = provider.createProductKey(
              // biome-ignore lint/suspicious/noExplicitAny: it is dynamic TODO: Improve
              parsedConfiguration as any
            );

            return yield* db.transaction((tx) =>
              TransactionContext.provide(tx)(
                Effect.gen(function* () {
                  yield* paymentProviderConfigurationProductRepository.updatePaymentProviderProduct(
                    {
                      id: providerProduct.id,
                      newProviderProductKey,
                      configuration: parsedConfiguration
                    }
                  );

                  yield* Effect.log(
                    `Updated payment provider product for product ${providerProduct.productId}`
                  );

                  return yield* Effect.succeed(undefined);
                })
              )
            );
          }),

        setActivePaymentProviderProduct: (input: {
          productId: string;
          providerProductKey: string;
          paymentProviderConfigurationId: string;
        }) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const productRepository = yield* ProductRepository;
            const paymentProviderConfigurationProductRepository =
              yield* PaymentProviderConfigurationProductRepository;
            const db = yield* Db;

            // Get product and provider configuration in parallel
            const [product, providerConfiguration] = yield* Effect.all(
              [
                productRepository.getProductById(input.productId),
                db.use(async (dbInstance) => {
                  return await dbInstance.query.paymentProviderConfigurations.findFirst(
                    {
                      where: (configs, { eq }) =>
                        eq(configs.id, input.paymentProviderConfigurationId)
                    }
                  );
                })
              ],
              {
                concurrency: 'unbounded'
              }
            );

            if (!product) {
              return yield* Effect.fail(
                new ProductNotFound({
                  message: `Product ${input.productId} not found`
                })
              );
            }

            if (!providerConfiguration) {
              return yield* Effect.fail(
                new PaymentProviderConfigurationNotFound({
                  message: `Payment provider configuration ${input.paymentProviderConfigurationId} not found`
                })
              );
            }

            // SECURITY: Authorization checks
            yield* checkProjectPermission(
              product.projectId,
              'project:all',
              `User ${session?.user?.id} is not authorized to update payment provider products for project ${product.projectId}`
            );

            yield* checkProjectPermission(
              providerConfiguration.projectId,
              'project:all',
              `User ${session?.user?.id} is not authorized to access payment provider configuration for project ${providerConfiguration.projectId}`
            );

            // Find the payment provider
            const provider = paymentProviders.find(
              (p) => p.getId() === providerConfiguration.providerId
            );
            if (!provider) {
              return yield* Effect.fail(
                new PaymentProviderNotFound({
                  message: `Payment provider ${providerConfiguration.providerId} not found`
                })
              );
            }

            return yield* db.transaction((tx) =>
              TransactionContext.provide(tx)(
                Effect.gen(function* () {
                  // Deactivate other provider products for this product/configuration
                  yield* paymentProviderConfigurationProductRepository.deactivateOtherProviderProducts(
                    {
                      productId: input.productId,
                      paymentProviderConfigurationId:
                        input.paymentProviderConfigurationId,
                      excludeProviderProductKey: input.providerProductKey
                    }
                  );

                  // Activate the selected provider product
                  yield* paymentProviderConfigurationProductRepository.setActivePaymentProviderProduct(
                    {
                      productId: input.productId,
                      paymentProviderConfigurationId:
                        input.paymentProviderConfigurationId,
                      providerProductKey: input.providerProductKey
                    }
                  );

                  yield* Effect.log(
                    `Set active payment provider product ${input.providerProductKey} for product ${input.productId}`
                  );

                  return yield* Effect.succeed(undefined);
                })
              )
            );
          }),

        // Query methods
        getProducts: (projectId: string) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const environment = yield* Environment;

            // SECURITY: Authorization check
            yield* checkProjectPermission(
              projectId,
              'project:all',
              `User ${session?.user?.id} is not authorized to access products for project ${projectId}`
            );

            return yield* productRepository.getProducts({
              projectId,
              environment
            });
          }),

        getProductById: (id: string) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const product = yield* productRepository.getProductById(id);
            if (!product) {
              return yield* Effect.fail(
                new NotFoundError({
                  message: 'Product not found'
                })
              );
            }

            // SECURITY: Authorization check
            yield* checkProjectPermission(
              product.projectId,
              'project:all',
              `User ${session?.user?.id} is not authorized to access product ${id} for project ${product.projectId}`
            );

            return product;
          }),

        // Provider product methods
        getProviderProductsByProductId: (productId: string) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const product = yield* productRepository.getProductById(productId);
            if (!product) {
              return yield* Effect.fail(
                new NotFoundError({
                  message: 'Product not found'
                })
              );
            }

            // SECURITY: Authorization check
            yield* checkProjectPermission(
              product.projectId,
              'project:all',
              `User ${session?.user?.id} is not authorized to access provider products for product ${productId}`
            );

            return yield* paymentProviderConfigurationProductRepository.getProviderProductsByProductId(
              productId
            );
          }),

        getProviderProductById: (id: string) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;

            const providerProduct =
              yield* paymentProviderConfigurationProductRepository.getProviderProductById(
                id
              );

            if (!providerProduct) {
              return yield* Effect.fail(
                new NotFoundError({
                  message: 'Provider product not found'
                })
              );
            }

            const product = yield* productRepository.getProductById(
              providerProduct.productId
            );

            if (!product) {
              return yield* Effect.fail(
                new ProductNotFound({
                  message: `Product ${providerProduct.productId} not found`
                })
              );
            }

            // SECURITY: Authorization check
            yield* checkProjectPermission(
              product.projectId,
              'project:all',
              `User ${session?.user?.id} is not authorized to access provider product for project ${product.projectId}`
            );

            return providerProduct;
          }),

        // Product perk methods
        getProductPerksByProductId: (productId: string) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const product = yield* productRepository.getProductById(productId);
            if (!product) {
              return yield* Effect.fail(
                new NotFoundError({
                  message: 'Product not found'
                })
              );
            }

            // SECURITY: Authorization check
            yield* checkProjectPermission(
              product.projectId,
              'project:all',
              `User ${session?.user?.id} is not authorized to access product perks for product ${productId}`
            );

            return yield* productPerkRepository.getProductPerksByProductId(
              productId
            );
          }),

        createProductPerk: (input: { productId: string; perkId: string }) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const productPerkRepository = yield* ProductPerkRepository;
            const perkRepository = yield* PerkRepository;

            // Get product to check authorization
            const product = yield* productRepository.getProductById(
              input.productId
            );
            if (!product) {
              return yield* Effect.fail(
                new ProductNotFound({
                  message: `Product ${input.productId} not found`
                })
              );
            }

            // SECURITY: Authorization check
            yield* checkProjectPermission(
              product.projectId,
              'project:all',
              `User ${session?.user?.id} is not authorized to create product perks for project ${product.projectId}`
            );

            // Validate perk exists (this also checks authorization)
            const perk = yield* perkRepository.getPerkById(input.perkId);
            if (!perk) {
              return yield* Effect.fail(
                new PerkNotFound({
                  message: `Perk ${input.perkId} not found`
                })
              );
            }

            // SECURITY: Authorization check
            yield* checkProjectPermission(
              perk.projectId,
              'project:all',
              `User ${session?.user?.id} is not authorized to create product perks in project ${product.projectId}`
            );

            const newProductPerk = {
              id: generateId('productPerk'),
              productId: input.productId,
              perkId: input.perkId
            };

            yield* productPerkRepository.createProductPerk(newProductPerk);

            yield* Effect.log(
              `Created product perk ${newProductPerk.id} for product ${input.productId}`
            );

            return yield* Effect.succeed({ id: newProductPerk.id });
          }),

        deleteProductPerk: (input: { productId: string; perkId: string }) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const productRepository = yield* ProductRepository;
            const productPerkRepository = yield* ProductPerkRepository;

            const product = yield* productRepository.getProductById(
              input.productId
            );

            if (!product) {
              return yield* Effect.fail(
                new ProductNotFound({
                  message: `Product ${input.productId} not found`
                })
              );
            }

            // SECURITY: Authorization check
            yield* checkProjectPermission(
              product.projectId,
              'project:all',
              `User ${session?.user?.id} is not authorized to delete product perks for product ${input.productId}`
            );

            yield* productPerkRepository.deleteProductPerk({
              productId: input.productId,
              perkId: input.perkId
            });

            yield* Effect.log(
              `Deleted product perk ${input.perkId} from product ${input.productId}`
            );

            return yield* Effect.succeed(undefined);

            // TODO: Think about deleting already granted perks.
          }),

        deletePaymentProviderProduct: (input: {
          productId: string;
          paymentProviderConfigurationId: string;
          providerProductKey: string;
        }) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const productRepository = yield* ProductRepository;
            const paymentProviderConfigurationProductRepository =
              yield* PaymentProviderConfigurationProductRepository;

            // Get the product to check authorization
            const product = yield* productRepository.getProductById(
              input.productId
            );
            if (!product) {
              return yield* Effect.fail(
                new ProductNotFound({
                  message: `Product ${input.productId} not found`
                })
              );
            }

            // SECURITY: Authorization check
            yield* checkProjectPermission(
              product.projectId,
              'project:all',
              `User ${session?.user?.id} is not authorized to delete payment provider products for project ${product.projectId}`
            );

            yield* paymentProviderConfigurationProductRepository.deletePaymentProviderProduct(
              {
                productId: input.productId,
                paymentProviderConfigurationId:
                  input.paymentProviderConfigurationId,
                providerProductKey: input.providerProductKey
              }
            );

            yield* Effect.log(
              `Deleted payment provider product for product ${input.productId}`
            );

            return yield* Effect.succeed(undefined);
          })
      };
    })
  }
) {}
