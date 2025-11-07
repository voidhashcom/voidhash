import { and, eq, productPerks, products } from '@voidhash/db';
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

const _deleteProductPerkRecord = (db: Db) =>
  db.makeQuery(
    (execute, { productId, perkId }: { productId: string; perkId: string }) =>
      execute(
        async (db) =>
          await db
            .delete(productPerks)
            .where(
              and(
                eq(productPerks.productId, productId),
                eq(productPerks.perkId, perkId)
              )
            )
      )
  );

export const deleteProductPerk = Effect.gen(function* () {
  const db = yield* Db;
  return Effect.fn('deleteProductPerk')(
    function* (input: { productId: string; perkId: string }) {
      const session = yield* AuthSession;

      const product = yield* _getProductById(db)(input.productId);

      if (!product) {
        return yield* Effect.fail(
          new ProductPerkValidationError({
            message: `Product ${input.productId} not found`
          })
        );
      }

      // SECURITY: Authorization check
      yield* checkProjectPermission(
        product.projectId,
        'project:all',
        `User ${session?.user?.id} is not authorized to delete product perks for product ${input.productId}`
      );

      yield* _deleteProductPerkRecord(db)({
        productId: input.productId,
        perkId: input.perkId
      });

      yield* Effect.log(
        `Deleted product perk ${input.perkId} from product ${input.productId}`
      );

      return;

      // TODO: Think about deleting already granted perks.
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
