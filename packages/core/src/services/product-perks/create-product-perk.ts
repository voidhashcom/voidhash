import {
  type InsertProductPerk,
  eq,
  perks,
  productPerks,
  products,
} from "@voidhash/db";
import { Db } from "@voidhash/db/effect";
import { generateId } from "@voidhash/lib";
import {
  AuthSession,
  ProductPerkServiceError,
  ProductPerkValidationError,
} from "@voidhash/shared";
import { Effect } from "effect";

import { checkProjectPermission } from "../../utils/permissions";

const _getProductById = (db: Db) =>
  db.makeQuery((execute, id: string) =>
    execute(
      async (db) =>
        await db.query.products.findFirst({
          where: eq(products.id, id),
        })
    )
  );

const _getPerkById = (db: Db) =>
  db.makeQuery((execute, id: string) =>
    execute(
      async (db) => await db.query.perks.findFirst({ where: eq(perks.id, id) })
    )
  );

const _createProductPerkRecord = (db: Db) =>
  db.makeQuery((execute, productPerk: InsertProductPerk) =>
    execute(async (db) => await db.insert(productPerks).values(productPerk))
  );

export const createProductPerk = Effect.gen(function* createProductPerk() {
  const db = yield* Db;
  return Effect.fn("createProductPerk")(
    function* createProductPerk(input: { productId: string; perkId: string }) {
      const session = yield* AuthSession;

      // Get product to check authorization
      const product = yield* _getProductById(db)(input.productId);
      if (!product) {
        return yield* Effect.fail(
          new ProductPerkValidationError({
            message: `Product ${input.productId} not found`,
          })
        );
      }

      // SECURITY: Authorization check
      yield* checkProjectPermission(
        product.projectId,
        "project:all",
        `User ${session?.user?.id} is not authorized to create product perks for project ${product.projectId}`
      );

      // Validate perk exists (this also checks authorization)
      const perk = yield* _getPerkById(db)(input.perkId);
      if (!perk) {
        return yield* Effect.fail(
          new ProductPerkValidationError({
            message: `Perk ${input.perkId} not found`,
          })
        );
      }

      // SECURITY: Authorization check
      yield* checkProjectPermission(
        perk.projectId,
        "project:all",
        `User ${session?.user?.id} is not authorized to create product perks in project ${product.projectId}`
      );

      const newProductPerk = {
        id: generateId("productPerk"),
        perkId: input.perkId,
        productId: input.productId,
      };

      yield* _createProductPerkRecord(db)(newProductPerk);

      yield* Effect.log(
        `Created product perk ${newProductPerk.id} for product ${input.productId}`
      );

      return { id: newProductPerk.id };
    },
    (effect) =>
      effect.pipe(
        Effect.catchTags({
          DatabaseError: (error) =>
            new ProductPerkServiceError({
              cause: String(error.cause),
            }),
        })
      )
  );
});
