import { eq, paymentProviderConfigurations } from "@voidhash/db";
import { Db } from "@voidhash/db/effect";
import {
  AuthSession,
  PaymentProviderConfigurationNotFoundError,
  PaymentProviderConfigurationServiceError,
} from "@voidhash/shared";
import { Effect } from "effect";

import { checkProjectPermission } from "../../utils/permissions";

const _getPaymentProviderConfigurationById = (db: Db) =>
  db.makeQuery((execute, id: string) =>
    execute(
      async (db) =>
        await db.query.paymentProviderConfigurations.findFirst({
          where: eq(paymentProviderConfigurations.id, id),
        })
    )
  );

export const getPaymentProviderConfigurationById = Effect.gen(
  function* getPaymentProviderConfigurationById() {
    const db = yield* Db;
    return Effect.fn("getPaymentProviderConfigurationById")(
      function* getPaymentProviderConfigurationById(id: string) {
        const session = yield* AuthSession;
        const configuration =
          yield* _getPaymentProviderConfigurationById(db)(id);

        if (!configuration) {
          return yield* Effect.fail(
            new PaymentProviderConfigurationNotFoundError({
              message: "Payment provider configuration not found",
            })
          );
        }

        // SECURITY: Authorization check
        yield* checkProjectPermission(
          configuration.projectId,
          "project:all",
          `User ${session?.user?.id} is not authorized to access payment provider configuration ${id} for project ${configuration.projectId}`
        );

        return configuration;
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            DatabaseError: (error) =>
              new PaymentProviderConfigurationServiceError({
                cause: String(error.cause),
              }),
          })
        )
    );
  }
);
