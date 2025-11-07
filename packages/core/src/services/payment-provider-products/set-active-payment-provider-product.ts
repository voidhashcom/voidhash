import {
  and,
  eq,
  not,
  paymentProviderConfigurationProducts,
  products
} from '@voidhash/db';
import { Db, TransactionContext } from '@voidhash/db/effect';
import {
  AuthSession,
  PaymentProviderProductServiceError,
  PaymentProviderProductValidationError
} from '@voidhash/shared';
import { Effect } from 'effect';
import { paymentProviders } from '../../payment-providers';
import { checkProjectPermission } from '../../utils/permissions';

const _getProductById = (db: Db) =>
  db.makeQuery((execute, id: string) =>
    execute(
      async (db) =>
        await db.query.products.findFirst({
          where: eq(products.id, id)
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

const _setActivePaymentProviderProductRecord = (db: Db) =>
  db.makeQuery(
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
  );

export const setActivePaymentProviderProduct = Effect.gen(function* () {
  const db = yield* Db;
  return Effect.fn('setActivePaymentProviderProduct')(
    function* (input: {
      productId: string;
      providerProductKey: string;
      paymentProviderConfigurationId: string;
    }) {
      const session = yield* AuthSession;

      // Get product and provider configuration in parallel
      const [product, providerConfiguration] = yield* Effect.all(
        [
          _getProductById(db)(input.productId),
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
            yield* _deactivateOtherProviderProducts(db)({
              productId: input.productId,
              paymentProviderConfigurationId:
                input.paymentProviderConfigurationId,
              excludeProviderProductKey: input.providerProductKey
            });

            // Activate the selected provider product
            yield* _setActivePaymentProviderProductRecord(db)({
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
    },
    (effect) =>
      effect.pipe(
        Effect.catchTags({
          DatabaseError: (error) =>
            new PaymentProviderProductServiceError({
              cause: String(error.cause)
            })
        })
      )
  );
});
