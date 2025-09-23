import { generateId } from '@voidhash/lib';
import { Effect, Schema } from 'effect';
import { appStore, paymentProviders, stripe } from '../payment-providers';
import { PaymentProviderConfigurationRepository } from '../repositories/payment-provider-repository';
import { checkProjectPermission } from '../utils/permissions';
import { AuthSession } from './auth-service';
import {
  PaymentProviderAlreadyExistsError,
  PaymentProviderConfigurationNotFound,
  PaymentProviderKeyUnavailableError,
  PaymentProviderNotFoundError
} from './errors';

export class PaymentProviderService extends Effect.Service<PaymentProviderService>()(
  'PaymentProviderService',
  {
    dependencies: [PaymentProviderConfigurationRepository.Default],
    effect: Effect.gen(function* () {
      const paymentProviderRepository =
        yield* PaymentProviderConfigurationRepository;
      return {
        createPaymentProviderConfiguration: (input: {
          projectId: string;
          providerId: string;
        }) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const paymentProviderRepository =
              yield* PaymentProviderConfigurationRepository;

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
              yield* paymentProviderRepository.getExistingPaymentProviderConfigurationByProviderId(
                {
                  projectId: input.projectId,
                  providerId: input.providerId
                }
              );

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

            yield* paymentProviderRepository.createPaymentProviderConfiguration(
              newConfiguration
            );
            yield* Effect.log(
              `Created payment provider configuration ${id} for project ${input.projectId}`
            );

            return yield* Effect.succeed({
              id
            });
          }),

        getPaymentProviderConfigurations: (projectId: string) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;

            // SECURITY: Authorization check
            yield* checkProjectPermission(
              projectId,
              'project:all',
              `User ${session?.user?.id} is not authorized to access payment provider configurations for project ${projectId}`
            );

            return yield* paymentProviderRepository.getPaymentProviderConfigurations(
              projectId
            );
          }),

        getPaymentProviderConfigurationById: (id: string) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const configuration =
              yield* paymentProviderRepository.getPaymentProviderConfigurationById(
                id
              );

            if (!configuration) {
              return yield* Effect.fail(
                new PaymentProviderConfigurationNotFound({
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
          }),

        updatePaymentProviderConfiguration: (input: {
          id: string;
          enabled: boolean;
          name?: string;
          configuration: Record<string, unknown>;
        }) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const paymentProviderRepository =
              yield* PaymentProviderConfigurationRepository;

            // Get existing configuration
            const existingConfiguration =
              yield* paymentProviderRepository.getPaymentProviderConfigurationById(
                input.id
              );
            if (!existingConfiguration) {
              return yield* Effect.fail(
                new PaymentProviderConfigurationNotFound({
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
              yield* paymentProviderRepository.updatePaymentProviderConfiguration(
                {
                  id: input.id,
                  configuration: input.configuration,
                  enabled: false,
                  name: input.name
                }
              );
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

            const isKeyAvailable =
              yield* paymentProviderRepository.checkPaymentProviderKeyAvailability(
                {
                  key: configurationValidationResult.paymentProviderKey,
                  providerId: existingConfiguration.providerId,
                  projectId: existingConfiguration.projectId,
                  excludeId: input.id
                }
              );

            if (!isKeyAvailable) {
              return yield* Effect.fail(
                new PaymentProviderKeyUnavailableError({
                  message:
                    'Payment provider with similar configuration already exists.'
                })
              );
            }

            // Update the configuration
            yield* paymentProviderRepository.updatePaymentProviderConfiguration(
              {
                id: input.id,
                configuration: input.configuration,
                enabled: input.enabled,
                name: input.name
              }
            );

            yield* Effect.log(
              `Updated payment provider configuration ${input.id}. The configuration was validated and the payment provider is enabled.`
            );

            return yield* Effect.succeed({
              id: input.id
            });
          }),

        deletePaymentProviderConfiguration: (input: {
          paymentProviderConfigurationId: string;
        }) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const paymentProviderRepository =
              yield* PaymentProviderConfigurationRepository;

            // Get the payment provider configuration
            const paymentProviderConfiguration =
              yield* paymentProviderRepository.getPaymentProviderConfigurationById(
                input.paymentProviderConfigurationId
              );

            if (!paymentProviderConfiguration) {
              return yield* Effect.fail(
                new PaymentProviderConfigurationNotFound({
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
            yield* paymentProviderRepository.deletePaymentProviderConfiguration(
              input.paymentProviderConfigurationId
            );

            yield* Effect.log(
              `Deleted payment provider configuration ${input.paymentProviderConfigurationId}`
            );

            return yield* Effect.succeed(undefined);
          })
      };
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
