import { eq, paymentProviderConfigurationProducts } from "@voidhash/db";
import { Db } from "@voidhash/db/effect";
import {
  AuthSession,
  PaymentProviderProductServiceError,
  PaymentProviderProductValidationError,
} from "@voidhash/shared";
import { Effect } from "effect";

import { checkProjectPermission } from "../../utils/permissions";

const _getPaymentProviderProductById = (db: Db) =>
  db.makeQuery((execute, id: string) =>
    execute(
      async (db) =>
        await db.query.paymentProviderConfigurationProducts.findFirst({
          where: eq(paymentProviderConfigurationProducts.id, id),
          with: {
            product: true,
          },
        })
    )
  );

const _deletePaymentProviderProductRecord = (db: Db) =>
  db.makeQuery((execute, id: string) =>
    execute(
      async (db) =>
        await db
          .delete(paymentProviderConfigurationProducts)
          .where(eq(paymentProviderConfigurationProducts.id, id))
    )
  );

export const deletePaymentProviderProduct = Effect.gen(
  function* deletePaymentProviderProduct() {
    const db = yield* Db;
    return Effect.fn("deletePaymentProviderProduct")(
      function* deletePaymentProviderProduct(input: { id: string }) {
        const session = yield* AuthSession;

        const ppp = yield* _getPaymentProviderProductById(db)(input.id);

        if (!ppp) {
          return yield* Effect.fail(
            new PaymentProviderProductValidationError({
              message: `Payment provider product ${input.id} not found`,
            })
          );
        }

        // SECURITY: Authorization check
        yield* checkProjectPermission(
          ppp.product.projectId,
          "project:all",
          `User ${session?.user?.id} is not authorized to delete payment provider products for project ${ppp.product.projectId}`
        );

        yield* _deletePaymentProviderProductRecord(db)(input.id);

        yield* Effect.log(`Deleted payment provider product ${input.id}`);

        return yield* Effect.void;
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
