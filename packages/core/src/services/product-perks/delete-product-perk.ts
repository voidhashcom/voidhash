import { eq, productPerks } from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import {
  AuthSession,
  ProductPerkServiceError,
  ProductPerkValidationError
} from '@voidhash/shared';
import { Effect } from 'effect';
import { checkProjectPermission } from '../../utils/permissions';

const _getProductPerkById = (db: Db) =>
  db.makeQuery((execute, id: string) =>
    execute(
      async (db) =>
        await db.query.productPerks.findFirst({
          where: eq(productPerks.id, id),
          with: {
            product: true
          }
        })
    )
  );

const _deleteProductPerkRecord = (db: Db) =>
  db.makeQuery((execute, id: string) =>
    execute(
      async (db) => await db.delete(productPerks).where(eq(productPerks.id, id))
    )
  );

export const deleteProductPerk = Effect.gen(function* () {
  const db = yield* Db;
  return Effect.fn('deleteProductPerk')(
    function* (input: { id: string }) {
      const session = yield* AuthSession;

      const productPerk = yield* _getProductPerkById(db)(input.id);

      if (!productPerk) {
        return yield* Effect.fail(
          new ProductPerkValidationError({
            message: `Product perk ${input.id} not found`
          })
        );
      }

      // SECURITY: Authorization check
      yield* checkProjectPermission(
        productPerk.product.projectId,
        'project:all',
        `User ${session?.user?.id} is not authorized to delete product perks for project ${productPerk.product.projectId}`
      );

      yield* _deleteProductPerkRecord(db)(input.id);

      yield* Effect.log(`Deleted product perk ${input.id}`);

      return;
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
