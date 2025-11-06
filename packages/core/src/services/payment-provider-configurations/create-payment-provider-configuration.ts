import {
  and,
  eq,
  type InsertPaymentProviderConfiguration,
  isNull,
  paymentProviderConfigurations
} from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import { generateId } from '@voidhash/lib';
import {
  AuthSession,
  PaymentProviderAlreadyExistsError,
  PaymentProviderConfigurationServiceError,
  PaymentProviderConfigurationValidationError
} from '@voidhash/shared';
import { Effect } from 'effect';
import { paymentProviders } from '../../payment-providers';
import { checkProjectPermission } from '../../utils/permissions';

const _getExistingPaymentProviderConfigurationByProviderId = (db: Db) =>
  db.makeQuery(
    (
      execute,
      input: {
        projectId: string;
        providerId: string;
      }
    ) =>
      execute(
        async (db) =>
          await db.query.paymentProviderConfigurations.findFirst({
            where: and(
              eq(paymentProviderConfigurations.projectId, input.projectId),
              eq(paymentProviderConfigurations.providerId, input.providerId),
              isNull(paymentProviderConfigurations.deletedAt)
            )
          })
      )
  );

const _createPaymentProviderConfigurationRecord = (db: Db) =>
  db.makeQuery((execute, configuration: InsertPaymentProviderConfiguration) =>
    execute(
      async (db) =>
        await db.insert(paymentProviderConfigurations).values(configuration)
    )
  );

export const createPaymentProviderConfiguration = Effect.gen(function* () {
  const db = yield* Db;
  return Effect.fn('createPaymentProviderConfiguration')(
    function* (input: { projectId: string; providerId: string }) {
      const session = yield* AuthSession;

      // SECURITY: Authorization check
      yield* checkProjectPermission(
        input.projectId,
        'project:all',
        `User ${session?.user?.id} is not authorized to create payment provider configurations for project ${input.projectId}`
      );

      // Find the payment provider
      const provider = paymentProviders.find((p) => p.id === input.providerId);
      if (!provider) {
        return yield* Effect.fail(
          new PaymentProviderConfigurationValidationError({
            cause: `Provider ${input.providerId} not found`
          })
        );
      }

      const existingConfiguration =
        yield* _getExistingPaymentProviderConfigurationByProviderId(db)({
          projectId: input.projectId,
          providerId: input.providerId
        });

      if (existingConfiguration) {
        return yield* Effect.fail(
          new PaymentProviderAlreadyExistsError({
            message: `Provider ${input.providerId} can only have one configuration`
          })
        );
      }

      const id = generateId('paymentProviderConfiguration');

      const newConfiguration = {
        id,
        configuration: provider.defaultGlobalConfiguration,
        enabled: false,
        name: provider.title,
        providerId: input.providerId,
        projectId: input.projectId,
        paymentProviderKey: 'empty'
      };

      yield* _createPaymentProviderConfigurationRecord(db)(newConfiguration);
      yield* Effect.log(
        `Created payment provider configuration ${id} for project ${input.projectId}`
      );

      return yield* Effect.succeed({
        id
      });
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
