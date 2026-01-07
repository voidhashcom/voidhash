import {
  asc,
  eq,
  paymentProviderConfigurationProducts,
  paymentProviderConfigurations,
  products,
} from "@voidhash/db";
import { Db } from "@voidhash/db/effect";
import {
  AuthSession,
  PaymentProviderProductServiceError,
} from "@voidhash/shared";
import { Effect } from "effect";

import { checkProjectPermission } from "../../utils/permissions";

/**
 * Query to get all payment provider products for a project.
 * Joins with products table to filter by projectId and
 * joins with paymentProviderConfigurations to get providerId.
 */
const _getProviderProductsByProjectId = (db: Db) =>
  db.makeQuery((execute, projectId: string) =>
    execute(async (dbClient) =>
      (
        await dbClient
          .select()
          .from(paymentProviderConfigurationProducts)
          .innerJoin(
            products,
            eq(paymentProviderConfigurationProducts.productId, products.id)
          )
          .innerJoin(
            paymentProviderConfigurations,
            eq(
              paymentProviderConfigurationProducts.paymentProviderConfigurationId,
              paymentProviderConfigurations.id
            )
          )
          .where(eq(products.projectId, projectId))
          .orderBy(asc(paymentProviderConfigurationProducts.createdAt))
      ).map((row) => ({
        configuration: row.payment_provider_configuration_product.configuration,
        id: row.payment_provider_configuration_product.id,
        paymentProviderConfigurationId:
          row.payment_provider_configuration_product
            .paymentProviderConfigurationId,
        productId: row.payment_provider_configuration_product.productId,
        providerId: row.payment_provider_configuration.providerId,
      }))
    )
  );

export const getProviderProductsByProjectId = Effect.gen(
  function* getProviderProductsByProjectId() {
    const db = yield* Db;
    return Effect.fn("getProviderProductsByProjectId")(
      function* getProviderProductsByProjectId(projectId: string) {
        const session = yield* AuthSession;

        // SECURITY: Authorization check
        yield* checkProjectPermission(
          projectId,
          "project:all",
          `User ${session?.user?.id} is not authorized to access provider products for project ${projectId}`
        );

        return yield* _getProviderProductsByProjectId(db)(projectId);
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
