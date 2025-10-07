import {
  and,
  asc,
  eq,
  type InsertPaymentProviderConfigurationProduct,
  not,
  paymentProviderConfigurationProducts,
  products
} from '@voidhash/db';
import { Db, TransactionContext } from '@voidhash/db/effect';
import { generateId } from '@voidhash/lib';
import {
  AuthSession,
  PaymentProviderProductNotFoundError,
  PaymentProviderProductValidationError
} from '@voidhash/shared';
import { Effect, pipe, Schema } from 'effect';
import { appStore, paymentProviders, stripe } from '../payment-providers';
import { checkProjectPermission } from '../utils/permissions';

export class PaymentProviderProductService extends Effect.Service<PaymentProviderProductService>()(
  'PaymentProviderProductService',
  {
    dependencies: [],
    effect: Effect.gen(function* () {
      const dbService = yield* Db;

      const _getProductById = dbService.makeQuery((execute, id: string) =>
        execute(
          async (db) =>
            await db.query.products.findFirst({
              where: eq(products.id, id)
            })
        )
      );

      const _getPaymentProviderConfigurationById = dbService.makeQuery(
        (execute, id: string) =>
          execute(
            async (db) =>
              await db.query.paymentProviderConfigurations.findFirst({
                where: (configs, { eq }) => eq(configs.id, id)
              })
          )
      );

      const _deactivateOtherProviderProducts = dbService.makeQuery(
        (
          execute,
          {
            productId,
            paymentProviderConfigurationId,
            excludeProviderProductKey
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
      );

      const _createPaymentProviderProductRecord = dbService.makeQuery(
        (execute, providerProduct: InsertPaymentProviderConfigurationProduct) =>
          execute(
            async (db) =>
              await db
                .insert(paymentProviderConfigurationProducts)
                .values(providerProduct)
          )
      );

      const createPaymentProviderProduct = (input: {
        productId: string;
        paymentProviderConfigurationId: string;
        configuration: Record<string, unknown>;
      }) =>
        pipe(
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const db = yield* Db;

            // Get product and provider configuration in parallel
            const [product, providerConfiguration] = yield* Effect.all(
              [
                _getProductById(input.productId),
                _getPaymentProviderConfigurationById(
                  input.paymentProviderConfigurationId
                )
              ],
              {
                concurrency: 'unbounded'
              }
            );

            if (!product) {
              return yield* Effect.fail(
                new PaymentProviderProductValidationError({
                  message: `Product ${input.productId} not found`
                })
              );
            }

            if (!providerConfiguration) {
              return yield* Effect.fail(
                new PaymentProviderProductValidationError({
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
                new PaymentProviderProductValidationError({
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
                  yield* _deactivateOtherProviderProducts({
                    productId: product.id,
                    paymentProviderConfigurationId:
                      input.paymentProviderConfigurationId
                  });

                  // Create new provider product
                  const newProviderProduct = {
                    id: generateId('paymentProviderProduct'),
                    productId: product.id,
                    paymentProviderConfigurationId: providerConfiguration.id,
                    providerProductKey:
                      configurationValidationResult.productKey,
                    configuration:
                      configurationValidationResult.parsedConfiguration,
                    isActive: true
                  };

                  yield* _createPaymentProviderProductRecord(
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
          Effect.catchTags({})
        );

      const _getPaymentProviderProductById = dbService.makeQuery(
        (execute, id: string) =>
          execute(
            async (db) =>
              await db.query.paymentProviderConfigurationProducts.findFirst({
                where: eq(paymentProviderConfigurationProducts.id, id)
              })
          )
      );

      const _updatePaymentProviderProductRecord = dbService.makeQuery(
        (
          execute,
          {
            id,
            newProviderProductKey,
            configuration
          }: {
            id: string;
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
                  configuration
                })
                .where(and(eq(paymentProviderConfigurationProducts.id, id)))
          )
      );

      const updatePaymentProviderProduct = (input: {
        // productId: string;
        // providerProductKey: string;
        // paymentProviderConfigurationId: string;
        paymentProviderConfigurationProductId: string;
        configuration: Record<string, unknown>;
      }) =>
        Effect.gen(function* () {
          const session = yield* AuthSession;
          const db = yield* Db;

          const providerProduct = yield* _getPaymentProviderProductById(
            input.paymentProviderConfigurationProductId
          );

          if (!providerProduct) {
            return yield* Effect.fail(
              new PaymentProviderProductNotFoundError({
                message: 'Provider product not found'
              })
            );
          }

          // Get product and provider configuration in parallel
          const [product, providerConfiguration] = yield* Effect.all([
            _getProductById(providerProduct.productId),
            _getPaymentProviderConfigurationById(
              providerProduct.paymentProviderConfigurationId
            )
          ]);

          if (!product) {
            return yield* Effect.fail(
              new PaymentProviderProductValidationError({
                message: `Product ${providerProduct.productId} not found`
              })
            );
          }

          if (!providerConfiguration) {
            return yield* Effect.fail(
              new PaymentProviderProductValidationError({
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
              new PaymentProviderProductValidationError({
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
                yield* _updatePaymentProviderProductRecord({
                  id: providerProduct.id,
                  newProviderProductKey:
                    configurationValidationResult.productKey,
                  configuration:
                    configurationValidationResult.parsedConfiguration
                });

                yield* Effect.log(
                  `Updated payment provider product for product ${providerProduct.productId}`
                );

                return yield* Effect.succeed(undefined);
              })
            )
          );
        });

      const _setActivePaymentProviderProductRecord = dbService.makeQuery(
        (
          execute,
          {
            productId,
            paymentProviderConfigurationId,
            providerProductKey
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
      );

      const setActivePaymentProviderProduct = (input: {
        productId: string;
        providerProductKey: string;
        paymentProviderConfigurationId: string;
      }) =>
        Effect.gen(function* () {
          const session = yield* AuthSession;
          const db = yield* Db;

          // Get product and provider configuration in parallel
          const [product, providerConfiguration] = yield* Effect.all(
            [
              _getProductById(input.productId),
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
              new PaymentProviderProductValidationError({
                message: `Product ${input.productId} not found`
              })
            );
          }

          if (!providerConfiguration) {
            return yield* Effect.fail(
              new PaymentProviderProductValidationError({
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
              new PaymentProviderProductValidationError({
                message: `Payment provider ${providerConfiguration.providerId} not found`
              })
            );
          }

          return yield* db.transaction((tx) =>
            TransactionContext.provide(tx)(
              Effect.gen(function* () {
                // Deactivate other provider products for this product/configuration
                yield* _deactivateOtherProviderProducts({
                  productId: input.productId,
                  paymentProviderConfigurationId:
                    input.paymentProviderConfigurationId,
                  excludeProviderProductKey: input.providerProductKey
                });

                // Activate the selected provider product
                yield* _setActivePaymentProviderProductRecord({
                  productId: input.productId,
                  paymentProviderConfigurationId:
                    input.paymentProviderConfigurationId,
                  providerProductKey: input.providerProductKey
                });

                yield* Effect.log(
                  `Set active payment provider product ${input.providerProductKey} for product ${input.productId}`
                );

                return yield* Effect.succeed(undefined);
              })
            )
          );
        });

      const _getProviderProductsByProductId = dbService.makeQuery(
        (execute, productId: string) =>
          execute(
            async (db) =>
              await db.query.paymentProviderConfigurationProducts.findMany({
                where: eq(
                  paymentProviderConfigurationProducts.productId,
                  productId
                ),
                orderBy: [asc(paymentProviderConfigurationProducts.createdAt)]
              })
          )
      );

      // Provider product methods
      const getProviderProductsByProductId = (productId: string) =>
        Effect.gen(function* () {
          const session = yield* AuthSession;

          const product = yield* _getProductById(productId);
          if (!product) {
            return yield* Effect.fail(
              new PaymentProviderProductValidationError({
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

          return yield* _getProviderProductsByProductId(productId);
        });

      const _getProviderProductById = dbService.makeQuery(
        (execute, id: string) =>
          execute(
            async (db) =>
              await db.query.paymentProviderConfigurationProducts.findFirst({
                where: eq(paymentProviderConfigurationProducts.id, id)
              })
          )
      );

      const getProviderProductById = (id: string) =>
        Effect.gen(function* () {
          const session = yield* AuthSession;

          const providerProduct = yield* _getProviderProductById(id);

          if (!providerProduct) {
            return yield* Effect.fail(
              new PaymentProviderProductNotFoundError({
                message: 'Provider product not found'
              })
            );
          }

          const product = yield* _getProductById(providerProduct.productId);

          if (!product) {
            return yield* Effect.fail(
              new PaymentProviderProductValidationError({
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
        });

      const _deletePaymentProviderProductRecord = dbService.makeQuery(
        (
          execute,
          {
            productId,
            paymentProviderConfigurationId,
            providerProductKey
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
      );

      const deletePaymentProviderProduct = (input: {
        productId: string;
        paymentProviderConfigurationId: string;
        providerProductKey: string;
      }) =>
        Effect.gen(function* () {
          const session = yield* AuthSession;

          // Get the product to check authorization
          const product = yield* _getProductById(input.productId);
          if (!product) {
            return yield* Effect.fail(
              new PaymentProviderProductValidationError({
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

          yield* _deletePaymentProviderProductRecord({
            productId: input.productId,
            paymentProviderConfigurationId:
              input.paymentProviderConfigurationId,
            providerProductKey: input.providerProductKey
          });

          yield* Effect.log(
            `Deleted payment provider product for product ${input.productId}`
          );

          return yield* Effect.succeed(undefined);
        });

      return {
        createPaymentProviderProduct,
        updatePaymentProviderProduct,
        setActivePaymentProviderProduct,
        getProviderProductsByProductId,
        getProviderProductById,
        deletePaymentProviderProduct
      } as const;
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

    return yield* Effect.dieMessage(
      `Failed to validate product configuration and create product key for provider ${providerId}, because validateProductConfigurationAndCreateProductKey does not support this provider.`
    );
  });
