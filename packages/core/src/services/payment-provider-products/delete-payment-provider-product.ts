import {
  and,
  eq,
  paymentProviderConfigurationProducts,
  products
} from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import {
  AuthSession,
  PaymentProviderProductServiceError,
  PaymentProviderProductValidationError
} from '@voidhash/shared';
import { Effect } from 'effect';
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

const _deletePaymentProviderProductRecord = (db: Db) =>
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
  );

export const deletePaymentProviderProduct = Effect.gen(function* () {
  const db = yield* Db;
  return Effect.fn('deletePaymentProviderProduct')(
    function* (input: {
      productId: string;
      paymentProviderConfigurationId: string;
      providerProductKey: string;
    }) {
      const session = yield* AuthSession;

      // Get the product to check authorization
      const product = yield* _getProductById(db)(input.productId);
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

      yield* _deletePaymentProviderProductRecord(db)({
        productId: input.productId,
        paymentProviderConfigurationId: input.paymentProviderConfigurationId,
        providerProductKey: input.providerProductKey
      });

      yield* Effect.log(
        `Deleted payment provider product for product ${input.productId}`
      );

      return yield* Effect.succeed(undefined);
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
