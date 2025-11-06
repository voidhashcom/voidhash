import { PaymentProviderConfigurationValidationError } from '@voidhash/shared';
import { Effect, Schema } from 'effect';
import { appStore, stripe } from '../../payment-providers';

export const validateGlobalConfigurationAndCreatePaymentProviderKey = (
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
      new PaymentProviderConfigurationValidationError({
        cause: `Failed to validate global configuration and create payment provider key for provider ${providerId}, because validateGlobalConfigurationAndCreatePaymentProviderKey does not support this provider.`
      })
    );
  });
