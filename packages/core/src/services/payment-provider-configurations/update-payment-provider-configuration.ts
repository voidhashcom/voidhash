import {
  and,
  eq,
  isNull,
  ne,
  paymentProviderConfigurations
} from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import {
  AuthSession,
  PaymentProviderConfigurationKeyUnavailableError,
  PaymentProviderConfigurationNotFoundError,
  PaymentProviderConfigurationServiceError,
  PaymentProviderConfigurationValidationError
} from '@voidhash/shared';
import { Effect } from 'effect';
import { checkProjectPermission } from '../../utils/permissions';
import { validateGlobalConfigurationAndCreatePaymentProviderKey } from './validate-global-configuration-and-create-payment-provider-key';

const _getPaymentProviderConfigurationById = (db: Db) =>
  db.makeQuery((execute, id: string) =>
    execute(
      async (db) =>
        await db.query.paymentProviderConfigurations.findFirst({
          where: eq(paymentProviderConfigurations.id, id)
        })
    )
  );

const _updatePaymentProviderConfigurationRecord = (db: Db) =>
  db.makeQuery(
    (
      execute,
      input: {
        id: string;
        configuration?: Record<string, unknown>;
        enabled?: boolean;
        name?: string;
        paymentProviderKey?: string;
      }
    ) =>
      execute(
        async (db) =>
          await db
            .update(paymentProviderConfigurations)
            .set({
              ...(input.configuration !== undefined && {
                configuration: input.configuration
              }),
              ...(input.enabled !== undefined && {
                enabled: input.enabled
              }),
              ...(input.name !== undefined && { name: input.name }),
              ...(input.paymentProviderKey !== undefined && {
                paymentProviderKey: input.paymentProviderKey
              })
            })
            .where(eq(paymentProviderConfigurations.id, input.id))
      )
  );

const _checkPaymentProviderKeyAvailability = (db: Db) =>
  db.makeQuery(
    (
      execute,
      input: {
        key: string;
        providerId: string;
        projectId: string;
        excludeId?: string;
      }
    ) =>
      execute(async (db) => {
        const conditions = [
          eq(paymentProviderConfigurations.projectId, input.projectId),
          eq(paymentProviderConfigurations.providerId, input.providerId),
          eq(paymentProviderConfigurations.paymentProviderKey, input.key),
          isNull(paymentProviderConfigurations.deletedAt)
        ];

        if (input.excludeId) {
          conditions.push(
            ne(paymentProviderConfigurations.id, input.excludeId)
          );
        }

        const existingConfigurations = await db
          .select()
          .from(paymentProviderConfigurations)
          .where(and(...conditions));

        return existingConfigurations.length === 0;
      })
  );

export const updatePaymentProviderConfiguration = Effect.gen(function* () {
  const db = yield* Db;
  return Effect.fn('updatePaymentProviderConfiguration')(
    function* (input: {
      id: string;
      enabled: boolean;
      name?: string;
      configuration: Record<string, unknown>;
    }) {
      const session = yield* AuthSession;

      // Get existing configuration
      const existingConfiguration = yield* _getPaymentProviderConfigurationById(
        db
      )(input.id);
      if (!existingConfiguration) {
        return yield* Effect.fail(
          new PaymentProviderConfigurationNotFoundError({
            message: 'Payment provider configuration not found'
          })
        );
      }

      // SECURITY: Authorization check
      yield* checkProjectPermission(
        existingConfiguration.projectId,
        'project:all',
        `User ${session?.user?.id} is not authorized to update payment provider configuration ${input.id}`
      );

      // We validate only configurations, that are enabled. This allows to save in-progress configurations.
      const requireValidation = input.enabled;
      if (!requireValidation) {
        yield* _updatePaymentProviderConfigurationRecord(db)({
          id: input.id,
          configuration: input.configuration,
          enabled: false,
          name: input.name
        });
        yield* Effect.log(
          `Updated payment provider configuration ${input.id}. The configuration was not validated because the provider is not enabled, or it was disabled.`
        );
        return yield* Effect.succeed({
          id: input.id
        });
      }

      const configurationValidationResult =
        yield* validateGlobalConfigurationAndCreatePaymentProviderKey(
          existingConfiguration.providerId,
          input.configuration
        );

      const isKeyAvailable = yield* _checkPaymentProviderKeyAvailability(db)({
        key: configurationValidationResult.paymentProviderKey,
        providerId: existingConfiguration.providerId,
        projectId: existingConfiguration.projectId,
        excludeId: input.id
      });

      if (!isKeyAvailable) {
        return yield* Effect.fail(
          new PaymentProviderConfigurationKeyUnavailableError({
            message:
              'Payment provider with similar configuration already exists.'
          })
        );
      }

      // Update the configuration
      yield* _updatePaymentProviderConfigurationRecord(db)({
        id: input.id,
        configuration: input.configuration,
        enabled: input.enabled,
        name: input.name
      });

      yield* Effect.log(
        `Updated payment provider configuration ${input.id}. The configuration was validated and the payment provider is enabled.`
      );

      return yield* Effect.succeed({
        id: input.id
      });
    },
    (effect) =>
      effect.pipe(
        Effect.catchTags({
          DatabaseError: (error) =>
            new PaymentProviderConfigurationServiceError({
              cause: String(error.cause)
            }),
          ParseError: (error) =>
            new PaymentProviderConfigurationValidationError({
              cause: String(error.cause)
            })
        })
      )
  );
});
