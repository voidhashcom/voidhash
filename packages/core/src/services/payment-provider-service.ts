import {
  and,
  eq,
  type InsertPaymentProviderConfiguration,
  isNull,
  ne,
  paymentProviderConfigurations
} from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import { generateId } from '@voidhash/lib';
import {
  AuthSession,
  PaymentProviderAlreadyExistsError,
  PaymentProviderConfigurationNotFoundError,
  PaymentProviderKeyUnavailableError,
  PaymentProviderNotFoundError
} from '@voidhash/shared';
import { Effect, Schema } from 'effect';
import { appStore, paymentProviders, stripe } from '../payment-providers';
import { checkProjectPermission } from '../utils/permissions';

export class PaymentProviderService extends Effect.Service<PaymentProviderService>()(
  'PaymentProviderService',
  {
    dependencies: [],
    effect: Effect.gen(function* () {
      const dbService = yield* Db;

      const _getExistingPaymentProviderConfigurationByProviderId =
        dbService.makeQuery(
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
                    eq(
                      paymentProviderConfigurations.projectId,
                      input.projectId
                    ),
                    eq(
                      paymentProviderConfigurations.providerId,
                      input.providerId
                    ),
                    isNull(paymentProviderConfigurations.deletedAt)
                  )
                })
            )
        );

      const _createPaymentProviderConfigurationRecord = dbService.makeQuery(
        (execute, configuration: InsertPaymentProviderConfiguration) =>
          execute(
            async (db) =>
              await db
                .insert(paymentProviderConfigurations)
                .values(configuration)
          )
      );

      const _getPaymentProviderConfigurationsByProjectId = dbService.makeQuery(
        (execute, projectId: string) =>
          execute(
            async (db) =>
              await db.query.paymentProviderConfigurations.findMany({
                where: and(
                  eq(paymentProviderConfigurations.projectId, projectId),
                  isNull(paymentProviderConfigurations.deletedAt)
                )
              })
          )
      );

      const _getPaymentProviderConfigurationById = dbService.makeQuery(
        (execute, id: string) =>
          execute(
            async (db) =>
              await db.query.paymentProviderConfigurations.findFirst({
                where: eq(paymentProviderConfigurations.id, id)
              })
          )
      );

      const createPaymentProviderConfiguration = (input: {
        projectId: string;
        providerId: string;
      }) =>
        Effect.gen(function* () {
          const session = yield* AuthSession;

          // SECURITY: Authorization check
          yield* checkProjectPermission(
            input.projectId,
            'project:all',
            `User ${session?.user?.id} is not authorized to create payment provider configurations for project ${input.projectId}`
          );

          // Find the payment provider
          const provider = paymentProviders.find(
            (p) => p.id === input.providerId
          );
          if (!provider) {
            return yield* Effect.fail(
              new PaymentProviderNotFoundError({
                message: `Provider ${input.providerId} not found`
              })
            );
          }

          const existingConfiguration =
            yield* _getExistingPaymentProviderConfigurationByProviderId({
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

          yield* _createPaymentProviderConfigurationRecord(newConfiguration);
          yield* Effect.log(
            `Created payment provider configuration ${id} for project ${input.projectId}`
          );

          return yield* Effect.succeed({
            id
          });
        });

      const getPaymentProviderConfigurations = (projectId: string) =>
        Effect.gen(function* () {
          const session = yield* AuthSession;

          // SECURITY: Authorization check
          yield* checkProjectPermission(
            projectId,
            'project:all',
            `User ${session?.user?.id} is not authorized to access payment provider configurations for project ${projectId}`
          );

          return yield* _getPaymentProviderConfigurationsByProjectId(projectId);
        });

      const getPaymentProviderConfigurationById = (id: string) =>
        Effect.gen(function* () {
          const session = yield* AuthSession;
          const configuration = yield* _getPaymentProviderConfigurationById(id);

          if (!configuration) {
            return yield* Effect.fail(
              new PaymentProviderConfigurationNotFoundError({
                message: 'Payment provider configuration not found'
              })
            );
          }

          // SECURITY: Authorization check
          yield* checkProjectPermission(
            configuration.projectId,
            'project:all',
            `User ${session?.user?.id} is not authorized to access payment provider configuration ${id} for project ${configuration.projectId}`
          );

          return configuration;
        });

      const _updatePaymentProviderConfigurationRecord = dbService.makeQuery(
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

      const _checkPaymentProviderKeyAvailability = dbService.makeQuery(
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

      const updatePaymentProviderConfiguration = (input: {
        id: string;
        enabled: boolean;
        name?: string;
        configuration: Record<string, unknown>;
      }) =>
        Effect.gen(function* () {
          const session = yield* AuthSession;

          // Get existing configuration
          const existingConfiguration =
            yield* _getPaymentProviderConfigurationById(input.id);
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
            yield* _updatePaymentProviderConfigurationRecord({
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

          const isKeyAvailable = yield* _checkPaymentProviderKeyAvailability({
            key: configurationValidationResult.paymentProviderKey,
            providerId: existingConfiguration.providerId,
            projectId: existingConfiguration.projectId,
            excludeId: input.id
          });

          if (!isKeyAvailable) {
            return yield* Effect.fail(
              new PaymentProviderKeyUnavailableError({
                message:
                  'Payment provider with similar configuration already exists.'
              })
            );
          }

          // Update the configuration
          yield* _updatePaymentProviderConfigurationRecord({
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
        });

      const _deletePaymentProviderConfigurationRecord = dbService.makeQuery(
        (execute, id: string) =>
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

      const deletePaymentProviderConfiguration = (input: {
        paymentProviderConfigurationId: string;
      }) =>
        Effect.gen(function* () {
          const session = yield* AuthSession;

          // Get the payment provider configuration
          const paymentProviderConfiguration =
            yield* _getPaymentProviderConfigurationById(
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
          yield* _deletePaymentProviderConfigurationRecord(
            input.paymentProviderConfigurationId
          );

          yield* Effect.log(
            `Deleted payment provider configuration ${input.paymentProviderConfigurationId}`
          );

          return yield* Effect.succeed(undefined);
        });

      return {
        createPaymentProviderConfiguration,
        getPaymentProviderConfigurations,
        getPaymentProviderConfigurationById,
        updatePaymentProviderConfiguration,
        deletePaymentProviderConfiguration
      } as const;
    })
  }
) {}

const validateGlobalConfigurationAndCreatePaymentProviderKey = (
  providerId: string,
  configuration: Record<string, unknown>
) =>
  Effect.gen(function* () {
    // Stripe
    if (providerId === stripe.id) {
      const parsedConfiguration = yield* Schema.decodeUnknown(
        stripe.globalConfigurationSchema
      )(configuration);

      return yield* Effect.succeed({
        parsedConfiguration,
        paymentProviderKey: stripe.createGlobalKey(parsedConfiguration)
      });
    }

    // App Store
    if (providerId === appStore.id) {
      const parsedConfiguration = yield* Schema.decodeUnknown(
        appStore.globalConfigurationSchema
      )(configuration);

      return yield* Effect.succeed({
        parsedConfiguration,
        paymentProviderKey: appStore.createGlobalKey(parsedConfiguration)
      });
    }

    Effect.logError(
      `Failed to validate global configuration and create payment provider key for provider ${providerId}, because validateGlobalConfigurationAndCreatePaymentProviderKey does not support this provider.`
    );
    return yield* Effect.fail(
      new PaymentProviderNotFoundError({
        message: `Payment provider ${providerId} not found`
      })
    );
  });
