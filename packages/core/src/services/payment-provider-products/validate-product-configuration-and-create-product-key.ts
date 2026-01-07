import { Effect, Schema } from "effect";

import { appStore, stripe } from "../../payment-providers";

export const validateProductConfigurationAndCreateProductKey = (
  providerId: string,
  configuration: Record<string, unknown>
) =>
  Effect.gen(function* validateProductConfigurationAndCreateProductKey() {
    // Stripe
    if (providerId === stripe.id) {
      const parsedConfiguration = yield* Schema.decodeUnknown(
        stripe.productConfigurationSchema
      )(configuration);

      return yield* Effect.succeed({
        parsedConfiguration,
        productKey: stripe.createProductKey(parsedConfiguration),
      });
    }

    // App Store
    if (providerId === appStore.id) {
      const parsedConfiguration = yield* Schema.decodeUnknown(
        appStore.productConfigurationSchema
      )(configuration);

      return yield* Effect.succeed({
        parsedConfiguration,
        productKey: appStore.createProductKey(parsedConfiguration),
      });
    }

    return yield* Effect.dieMessage(
      `Failed to validate product configuration and create product key for provider ${providerId}, because validateProductConfigurationAndCreateProductKey does not support this provider.`
    );
  });
