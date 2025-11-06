import { eq, paymentProviderConfigurations } from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import {
  AuthSession,
  PaymentProviderConfigurationNotFoundError,
  PaymentProviderConfigurationServiceError
} from '@voidhash/shared';
import { Effect } from 'effect';
import { checkProjectPermission } from '../../utils/permissions';

const _getPaymentProviderConfigurationById = (db: Db) =>
  db.makeQuery((execute, id: string) =>
    execute(
      async (db) =>
        await db.query.paymentProviderConfigurations.findFirst({
          where: eq(paymentProviderConfigurations.id, id)
        })
    )
  );

const _deletePaymentProviderConfigurationRecord = (db: Db) =>
  db.makeQuery((execute, id: string) =>
    execute(
      async (db) =>
        await db
          .update(paymentProviderConfigurations)
          .set({
            deletedAt: new Date()
          })
          .where(eq(paymentProviderConfigurations.id, id))
    )
  );

export const deletePaymentProviderConfiguration = Effect.gen(function* () {
  const db = yield* Db;
  return Effect.fn('deletePaymentProviderConfiguration')(
    function* (input: { paymentProviderConfigurationId: string }) {
      const session = yield* AuthSession;

      // Get the payment provider configuration
      const paymentProviderConfiguration =
        yield* _getPaymentProviderConfigurationById(db)(
          input.paymentProviderConfigurationId
        );

      if (!paymentProviderConfiguration) {
        return yield* Effect.fail(
          new PaymentProviderConfigurationNotFoundError({
            message: `Payment provider configuration with id ${input.paymentProviderConfigurationId} not found`
          })
        );
      }

      // SECURITY: Authorization check
      yield* checkProjectPermission(
        paymentProviderConfiguration.projectId,
        'project:all',
        `User ${session?.user?.id} is not authorized to delete payment provider configuration ${input.paymentProviderConfigurationId}`
      );

      // Soft delete the configuration
      yield* _deletePaymentProviderConfigurationRecord(db)(
        input.paymentProviderConfigurationId
      );

      yield* Effect.log(
        `Deleted payment provider configuration ${input.paymentProviderConfigurationId}`
      );

      return yield* Effect.succeed(undefined);
    },
    (effect) =>
      effect.pipe(
        Effect.catchTags({
          DatabaseError: (error) =>
            new PaymentProviderConfigurationServiceError({
              cause: String(error.cause)
            })
        })
      )
  );
});
