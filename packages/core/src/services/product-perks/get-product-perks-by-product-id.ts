import { asc, eq, productPerks, products } from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import {
  AuthSession,
  ProductPerkServiceError,
  ProductPerkValidationError
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

const _getProductPerksByProductId = (db: Db) =>
  db.makeQuery((execute, productId: string) =>
    execute(
      async (db) =>
        await db.query.productPerks.findMany({
          where: eq(productPerks.productId, productId),
          orderBy: [asc(productPerks.createdAt)]
        })
    )
  );

export const getProductPerksByProductId = Effect.gen(function* () {
  const db = yield* Db;
  return Effect.fn('getProductPerksByProductId')(
    function* (productId: string) {
      const session = yield* AuthSession;
      const product = yield* _getProductById(db)(productId);
      if (!product) {
        return yield* Effect.fail(
          new ProductPerkValidationError({
            message: `Product ${productId} not found`
          })
        );
      }

      // SECURITY: Authorization check
      yield* checkProjectPermission(
        product.projectId,
        'project:all',
        `User ${session?.user?.id} is not authorized to access product perks for product ${productId}`
      );

      return yield* _getProductPerksByProductId(db)(productId);
    },
    (effect) =>
      effect.pipe(
        Effect.catchTags({
          DatabaseError: (error) =>
            new ProductPerkServiceError({
              cause: String(error.cause)
            })
        })
      )
  );
});
