import { asc, eq, productPerks, products } from "@voidhash/db";
import { Db } from "@voidhash/db/effect";
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

const _getProductPerksByProductId = (db: Db) =>
  db.makeQuery((execute, productId: string) =>
    execute(
      async (db) =>
        await db.query.productPerks.findMany({
          orderBy: [asc(productPerks.createdAt)],
          where: eq(productPerks.productId, productId),
        })
    )
  );

export const getProductPerksByProductId = Effect.gen(
  function* getProductPerksByProductId() {
    const db = yield* Db;
    return Effect.fn("getProductPerksByProductId")(
      function* getProductPerksByProductId(productId: string) {
        const session = yield* AuthSession;
        const product = yield* _getProductById(db)(productId);
        if (!product) {
          return yield* Effect.fail(
            new ProductPerkValidationError({
              message: `Product ${productId} not found`,
            })
          );
        }

        // SECURITY: Authorization check
        yield* checkProjectPermission(
          product.projectId,
          "project:all",
          `User ${session?.user?.id} is not authorized to access product perks for product ${productId}`
        );

        return yield* _getProductPerksByProductId(db)(productId);
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
  }
);
