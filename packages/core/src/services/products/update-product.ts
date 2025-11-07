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

const _updateProductRecord = (db: Db) =>
  db.makeQuery((execute, { id, name }: { id: string; name: string }) =>
    execute(
      async (db) =>
        await db
          .update(products)
          .set({ name, updatedAt: new Date() })
          .where(eq(products.id, id))
    )
  );

export const updateProduct = Effect.gen(function* () {
  const db = yield* Db;
  return Effect.fn('updateProduct')(
    function* (input: { productId: string; name: string }) {
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
        `User ${session?.user?.id} is not authorized to update product ${input.productId} for project ${existingProduct.projectId}`
      );

      yield* _updateProductRecord(db)({
        id: input.productId,
        name: input.name
      });

      yield* Effect.log(
        `Updated product ${input.productId} for project ${existingProduct.projectId}`
      );

      return;
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
