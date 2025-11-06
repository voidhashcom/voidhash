import { type InsertProduct, products } from '@voidhash/db';
import { Db, TransactionContext } from '@voidhash/db/effect';
import { generateId } from '@voidhash/lib';
import { AuthSession, ProductServiceError } from '@voidhash/shared';
import { Effect } from 'effect';
import { checkProjectPermission } from '../../utils/permissions';

const _createProductRecord = (db: Db) =>
  db.makeQuery((execute, product: InsertProduct) =>
    execute(async (db) => await db.insert(products).values(product))
  );

export const createProduct = Effect.gen(function* () {
  const db = yield* Db;
  return Effect.fn('createProduct')(
    function* (input: { projectId: string; name: string }) {
      const session = yield* AuthSession;

      // SECURITY: Authorization check
      yield* checkProjectPermission(
        input.projectId,
        'project:all',
        `User ${session?.user?.id} is not authorized to create products for project ${input.projectId}`
      );

      const productId = generateId('product');
      const newProduct = {
        id: productId,
        projectId: input.projectId,
        name: input.name
      };

      yield* db.transaction((tx) =>
        TransactionContext.provide(tx)(
          Effect.gen(function* () {
            // Create the product
            yield* _createProductRecord(db)(newProduct);
          })
        )
      );

      yield* Effect.log(
        `Created product ${productId} for project ${input.projectId}`
      );

      return { id: productId };
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
