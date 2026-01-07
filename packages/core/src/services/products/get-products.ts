import type { Product } from "@voidhash/api-spec";
import { and, eq, products } from "@voidhash/db";
import { Db } from "@voidhash/db/effect";
import type { ProductTypeValue } from "@voidhash/lib";
import { AuthSession, ProductServiceError } from "@voidhash/shared";
import { Effect } from "effect";

import { checkProjectPermission } from "../../utils/permissions";
import { dbProductTypeToApiProductType } from "./utils";

const _getProductsByProjectId = (db: Db) =>
  db.makeQuery((execute, input: { projectId: string }) =>
    execute(
      async (db) =>
        await db.query.products.findMany({
          where: and(eq(products.projectId, input.projectId)),
        })
    )
  );

export const getProducts = Effect.gen(function* getProducts() {
  const db = yield* Db;
  return Effect.fn("getProducts")(
    function* getProducts(projectId: string) {
      const session = yield* AuthSession;

      // SECURITY: Authorization check
      yield* checkProjectPermission(
        projectId,
        "project:all",
        `User ${session?.user?.id} is not authorized to access products for project ${projectId}`
      );

      const productsResult = yield* _getProductsByProjectId(db)({
        projectId,
      });

      return productsResult.map(
        (product) =>
          ({
            id: product.id,
            name: product.name,
            projectId: product.projectId,
            type: dbProductTypeToApiProductType(
              product.type as ProductTypeValue
            ),
          }) satisfies typeof Product.Type
      );
    },
    (effect) =>
      effect.pipe(
        Effect.catchTags({
          DatabaseError: (error) =>
            new ProductServiceError({
              cause: String(error.cause),
            }),
        })
      )
  );
});
