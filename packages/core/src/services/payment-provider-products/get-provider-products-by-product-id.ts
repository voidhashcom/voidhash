import {
  asc,
  eq,
  paymentProviderConfigurationProducts,
  products,
} from "@voidhash/db";
import { Db } from "@voidhash/db/effect";
import {
  AuthSession,
  PaymentProviderProductServiceError,
  PaymentProviderProductValidationError,
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

const _getProviderProductsByProductId = (db: Db) =>
  db.makeQuery((execute, productId: string) =>
    execute(
      async (db) =>
        await db.query.paymentProviderConfigurationProducts.findMany({
          orderBy: [asc(paymentProviderConfigurationProducts.createdAt)],
          where: eq(paymentProviderConfigurationProducts.productId, productId),
        })
    )
  );

export const getProviderProductsByProductId = Effect.gen(
  function* getProviderProductsByProductId() {
    const db = yield* Db;
    return Effect.fn("getProviderProductsByProductId")(
      function* getProviderProductsByProductId(productId: string) {
        const session = yield* AuthSession;

        const product = yield* _getProductById(db)(productId);
        if (!product) {
          return yield* Effect.fail(
            new PaymentProviderProductValidationError({
              message: "Product not found",
            })
          );
        }

        // SECURITY: Authorization check
        yield* checkProjectPermission(
          product.projectId,
          "project:all",
          `User ${session?.user?.id} is not authorized to access provider products for product ${productId}`
        );

        return yield* _getProviderProductsByProductId(db)(productId);
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            DatabaseError: (error) =>
              new PaymentProviderProductServiceError({
                cause: String(error.cause),
              }),
          })
        )
    );
  }
);
