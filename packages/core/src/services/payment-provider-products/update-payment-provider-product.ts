import {
  and,
  eq,
  paymentProviderConfigurationProducts,
  products
} from '@voidhash/db';
import { Db, TransactionContext } from '@voidhash/db/effect';
import {
  AuthSession,
  PaymentProviderProductNotFoundError,
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

const _getPaymentProviderProductById = (db: Db) =>
  db.makeQuery((execute, id: string) =>
    execute(
      async (db) =>
        await db.query.paymentProviderConfigurationProducts.findFirst({
          where: eq(paymentProviderConfigurationProducts.id, id)
        })
    )
  );

const _updatePaymentProviderProductRecord = (db: Db) =>
  db.makeQuery(
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

export const updatePaymentProviderProduct = Effect.gen(function* () {
  const db = yield* Db;
  return Effect.fn('updatePaymentProviderProduct')(
    function* (input: {
      paymentProviderConfigurationProductId: string;
      configuration: Record<string, unknown>;
    }) {
      const session = yield* AuthSession;

      const providerProduct = yield* _getPaymentProviderProductById(db)(
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
        _getProductById(db)(providerProduct.productId),
        _getPaymentProviderConfigurationById(db)(
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
            yield* _updatePaymentProviderProductRecord(db)({
              id: providerProduct.id,
              newProviderProductKey: configurationValidationResult.productKey,
              configuration: configurationValidationResult.parsedConfiguration
            });

            yield* Effect.log(
              `Updated payment provider product for product ${providerProduct.productId}`
            );

            return yield* Effect.succeed(undefined);
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
