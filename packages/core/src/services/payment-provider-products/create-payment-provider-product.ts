import {
  and,
  eq,
  not,
  paymentProviderConfigurationProducts,
  products
} from '@voidhash/db';
import { Db, TransactionContext } from '@voidhash/db/effect';
import { generateId } from '@voidhash/lib';
import {
  AuthSession,
  PaymentProviderProductServiceError,
  PaymentProviderProductValidationError
} from '@voidhash/shared';
import { Effect } from 'effect';
import { paymentProviders } from '../../payment-providers';
import { checkProjectPermission } from '../../utils/permissions';
import { validateProductConfigurationAndCreateProductKey } from './validate-product-configuration-and-create-product-key';

const _getProductById = (db: Db) =>
  db.makeQuery((execute, id: string) =>
    execute(
      async (db) =>
        await db.query.products.findFirst({
          where: eq(products.id, id)
        })
    )
  );

const _getPaymentProviderConfigurationById = (db: Db) =>
  db.makeQuery((execute, id: string) =>
    execute(
      async (db) =>
        await db.query.paymentProviderConfigurations.findFirst({
          where: (configs, { eq }) => eq(configs.id, id)
        })
    )
  );

const _deactivateOtherProviderProducts = (db: Db) =>
  db.makeQuery(
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
  );

const _createPaymentProviderProductRecord = (db: Db) =>
  db.makeQuery(
    (
      execute,
      providerProduct: import('@voidhash/db').InsertPaymentProviderConfigurationProduct
    ) =>
      execute(
        async (db) =>
          await db
            .insert(paymentProviderConfigurationProducts)
            .values(providerProduct)
      )
  );

export const createPaymentProviderProduct = Effect.gen(function* () {
  const db = yield* Db;
  return Effect.fn('createPaymentProviderProduct')(
    function* (input: {
      productId: string;
      paymentProviderConfigurationId: string;
      configuration: Record<string, unknown>;
    }) {
      const session = yield* AuthSession;

      // Get product and provider configuration in parallel
      const [product, providerConfiguration] = yield* Effect.all(
        [
          _getProductById(db)(input.productId),
          _getPaymentProviderConfigurationById(db)(
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
            yield* _deactivateOtherProviderProducts(db)({
              productId: product.id,
              paymentProviderConfigurationId:
                input.paymentProviderConfigurationId
            });

            // Create new provider product
            const newProviderProduct = {
              id: generateId('paymentProviderProduct'),
              productId: product.id,
              paymentProviderConfigurationId: providerConfiguration.id,
              providerProductKey: configurationValidationResult.productKey,
              configuration: configurationValidationResult.parsedConfiguration,
              isActive: true
            };

            yield* _createPaymentProviderProductRecord(db)(newProviderProduct);
            yield* Effect.log(
              `Created payment provider product ${newProviderProduct.id} for product ${product.id}`
            );

            return {
              id: newProviderProduct.id
            };
          })
        )
      );
    },
    (effect) =>
      effect.pipe(
        Effect.catchTags({
          DatabaseError: (error) =>
            new PaymentProviderProductServiceError({
              cause: String(error.cause)
            }),
          ParseError: (error) =>
            new PaymentProviderProductValidationError({
              message: String(error.cause)
            })
        })
      )
  );
});
