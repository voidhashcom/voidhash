import type { Product } from '@voidhash/api-spec';
import { eq, products } from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import type { ProductTypeValue } from '@voidhash/lib';
import {
  AuthSession,
  ProductNotFoundError,
  ProductServiceError
} from '@voidhash/shared';
import { Effect } from 'effect';
import { checkProjectPermission } from '../../utils/permissions';
import { dbProductTypeToApiProductType } from './utils';

const _getProductById = (db: Db) =>
  db.makeQuery((execute, id: string) =>
    execute(
      async (db) =>
        await db.query.products.findFirst({
          where: eq(products.id, id)
        })
    )
  );

export const getProductById = Effect.gen(function* () {
  const db = yield* Db;
  return Effect.fn('getProductById')(
    function* (id: string) {
      const session = yield* AuthSession;
      const product = yield* _getProductById(db)(id);
      if (!product) {
        return yield* Effect.fail(
          new ProductNotFoundError({
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

      return {
        id: product.id,
        name: product.name,
        projectId: product.projectId,
        type: dbProductTypeToApiProductType(product.type as ProductTypeValue)
      } satisfies typeof Product.Type;
    },
    (effect) =>
      effect.pipe(
        Effect.catchTags({
          DatabaseError: (error) =>
            new ProductServiceError({
              cause: String(error.cause)
            })
        })
      )
  );
});
