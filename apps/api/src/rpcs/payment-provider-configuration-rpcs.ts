import { PaymentProviderConfigurationService } from '@voidhash/core/services';
import { PaymentProviderConfigurationRpcsDef } from '@voidhash/rpc';
import { Effect, Layer } from 'effect';

export const PaymentProviderConfigurationRpcsLive =
  PaymentProviderConfigurationRpcsDef.toLayer(
    Effect.gen(function* () {
      const paymentProviderConfigurationService =
        yield* PaymentProviderConfigurationService;
      return {
        ListPaymentProviderConfigurations: ({ projectId }) =>
          Effect.gen(function* () {
            return yield* paymentProviderConfigurationService.getPaymentProviderConfigurations(
              projectId
            );
          }),
        GetPaymentProviderConfiguration: ({ id }) =>
          Effect.gen(function* () {
            return yield* paymentProviderConfigurationService.getPaymentProviderConfigurationById(
              id
            );
          }),
        CreatePaymentProviderConfiguration: (input) =>
          paymentProviderConfigurationService.createPaymentProviderConfiguration(
            input
          ),
        UpdatePaymentProviderConfiguration: (input) =>
          paymentProviderConfigurationService.updatePaymentProviderConfiguration(
            input
          ),
        DeletePaymentProviderConfiguration: (input) =>
          paymentProviderConfigurationService.deletePaymentProviderConfiguration(
            input
          )
      };
    })
  ).pipe(Layer.provide(PaymentProviderConfigurationService.Default));
