import { Db, TransactionContext } from '@voidhash/db/effect';
import { generateId } from '@voidhash/lib';
import { Effect, Schema } from 'effect';
import { appStore, paymentProviders, stripe } from '../payment-providers';
import { PaymentProviderConfigurationProductRepository } from '../repositories/payment-provider-configuration-product-repository';
import { PaymentProviderConfigurationRepository } from '../repositories/payment-provider-repository';
import { ProductRepository } from '../repositories/product-repository';
import { checkProjectPermission } from '../utils/permissions';
import { AuthSession } from './auth-service';

import {
  PaymentProviderConfigurationNotFound,
  PaymentProviderNotFoundError,
  ProductNotFound,
  ProviderProductNotFound
} from './errors';

export class PaymentProviderProductService extends Effect.Service<PaymentProviderProductService>()(
  'PaymentProviderProductService',
  {
    dependencies: [
      ProductRepository.Default,
      PaymentProviderConfigurationProductRepository.Default
    ],
    effect: Effect.gen(function* () {
      return {
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
              (p) => p.id === providerConfiguration.providerId
            );
            if (!provider) {
              return yield* Effect.fail(
                new PaymentProviderNotFoundError({
                  message: `Payment provider ${providerConfiguration.providerId} not found`
                })
              );
            }

            // Validate configuration
            const configurationValidationResult =
              yield* validateProductConfigurationAndCreateProductKey(
                providerConfiguration.providerId,
                input.configuration
              );

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
                    providerProductKey:
                      configurationValidationResult.productKey,
                    environment: product.environment,
                    configuration:
                      configurationValidationResult.parsedConfiguration,
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
              (p) => p.id === providerConfiguration.providerId
            );
            if (!provider) {
              return yield* Effect.fail(
                new PaymentProviderNotFoundError({
                  message: `Payment provider ${providerProduct.paymentProviderConfigurationId} not found`
                })
              );
            }

            // Validate configuration
            const configurationValidationResult =
              yield* validateProductConfigurationAndCreateProductKey(
                providerConfiguration.providerId,
                input.configuration
              );

            return yield* db.transaction((tx) =>
              TransactionContext.provide(tx)(
                Effect.gen(function* () {
                  yield* paymentProviderConfigurationProductRepository.updatePaymentProviderProduct(
                    {
                      id: providerProduct.id,
                      newProviderProductKey:
                        configurationValidationResult.productKey,
                      configuration:
                        configurationValidationResult.parsedConfiguration
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
              (p) => p.id === providerConfiguration.providerId
            );
            if (!provider) {
              return yield* Effect.fail(
                new PaymentProviderNotFoundError({
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

        // Provider product methods
        getProviderProductsByProductId: (productId: string) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const productRepository = yield* ProductRepository;
            const paymentProviderConfigurationProductRepository =
              yield* PaymentProviderConfigurationProductRepository;
            const product = yield* productRepository.getProductById(productId);
            if (!product) {
              return yield* Effect.fail(
                new ProductNotFound({
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
            const productRepository = yield* ProductRepository;
            const paymentProviderConfigurationProductRepository =
              yield* PaymentProviderConfigurationProductRepository;

            const providerProduct =
              yield* paymentProviderConfigurationProductRepository.getProviderProductById(
                id
              );

            if (!providerProduct) {
              return yield* Effect.fail(
                new ProviderProductNotFound({
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

const validateProductConfigurationAndCreateProductKey = (
  providerId: string,
  configuration: Record<string, unknown>
) =>
  Effect.gen(function* () {
    // Stripe
    if (providerId === stripe.id) {
      const parsedConfiguration = yield* Schema.decodeUnknown(
        stripe.productConfigurationSchema
      )(configuration);

      return yield* Effect.succeed({
        parsedConfiguration,
        productKey: stripe.createProductKey(parsedConfiguration)
      });
    }

    // App Store
    if (providerId === appStore.id) {
      const parsedConfiguration = yield* Schema.decodeUnknown(
        appStore.productConfigurationSchema
      )(configuration);

      return yield* Effect.succeed({
        parsedConfiguration,
        productKey: appStore.createProductKey(parsedConfiguration)
      });
    }

    Effect.logError(
      `Failed to validate product configuration and create product key for provider ${providerId}, because validateProductConfigurationAndCreateProductKey does not support this provider.`
    );
    return yield* Effect.fail(
      new PaymentProviderNotFoundError({
        message: `Payment provider ${providerId} not found`
      })
    );
  });
