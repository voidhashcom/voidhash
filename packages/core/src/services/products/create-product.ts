import { and, eq, type InsertProduct, products } from '@voidhash/db';
import { Db, TransactionContext } from '@voidhash/db/effect';
import { generateId } from '@voidhash/lib';
import {
  AuthSession,
  ProductServiceError,
  ProductSlugAlreadyExistsError
} from '@voidhash/shared';
import { Effect } from 'effect';
import { checkProjectPermission } from '../../utils/permissions';

const _createProductRecord = (db: Db) =>
  db.makeQuery((execute, product: InsertProduct) =>
    execute(async (db) => await db.insert(products).values(product))
  );

const _getProductBySlug = (db: Db) =>
  db.makeQuery((execute, input: { slug: string; projectId: string }) =>
    execute(
      async (db) =>
        await db.query.products.findFirst({
          where: and(
            eq(products.slug, input.slug),
            eq(products.projectId, input.projectId)
          )
        })
    )
  );

export const createProduct = Effect.gen(function* () {
  const db = yield* Db;
  return Effect.fn('createProduct')(
    function* (input: { projectId: string; name: string; slug: string }) {
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
        name: input.name,
        slug: input.slug
      };

      yield* db.transaction((tx) =>
        TransactionContext.provide(tx)(
          Effect.gen(function* () {
            const existingProduct = yield* _getProductBySlug(db)({
              slug: input.slug,
              projectId: input.projectId
            });
            if (existingProduct) {
              return yield* Effect.fail(
                new ProductSlugAlreadyExistsError({
                  slug: input.slug
                })
              );
            }
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
