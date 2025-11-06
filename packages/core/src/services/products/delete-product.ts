import { eq, products } from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import {
  AuthSession,
  ProductNotFoundError,
  ProductServiceError
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

const _deleteProductRecord = (db: Db) =>
  db.makeQuery((execute, id: string) =>
    execute(async (db) => await db.delete(products).where(eq(products.id, id)))
  );

export const deleteProduct = Effect.gen(function* () {
  const db = yield* Db;
  return Effect.fn('deleteProduct')(
    function* (input: { productId: string }) {
      const session = yield* AuthSession;

      // Get the product to check authorization
      const existingProduct = yield* _getProductById(db)(input.productId);
      if (!existingProduct) {
        return yield* Effect.fail(
          new ProductNotFoundError({
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

      yield* _deleteProductRecord(db)(input.productId);

      yield* Effect.log(
        `Deleted product ${input.productId} for project ${existingProduct.projectId}`
      );
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
