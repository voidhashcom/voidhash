import {
  eq,
  paymentProviderConfigurationProducts,
  products
} from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import {
  AuthSession,
  PaymentProviderProductNotFoundError,
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

const _getProviderProductById = (db: Db) =>
  db.makeQuery((execute, id: string) =>
    execute(
      async (db) =>
        await db.query.paymentProviderConfigurationProducts.findFirst({
          where: eq(paymentProviderConfigurationProducts.id, id)
        })
    )
  );

export const getProviderProductById = Effect.gen(function* () {
  const db = yield* Db;
  return Effect.fn('getProviderProductById')(
    function* (id: string) {
      const session = yield* AuthSession;

      const providerProduct = yield* _getProviderProductById(db)(id);

      if (!providerProduct) {
        return yield* Effect.fail(
          new PaymentProviderProductNotFoundError({
            message: 'Provider product not found'
          })
        );
      }

      const product = yield* _getProductById(db)(providerProduct.productId);

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
