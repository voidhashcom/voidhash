import { PaymentProviderConfigurationService } from "@voidhash/core/services";
import { PaymentProviderConfigurationRpcsDef } from "@voidhash/rpc";
import { Effect, Layer } from "effect";

export const PaymentProviderConfigurationRpcsLive =
  PaymentProviderConfigurationRpcsDef.toLayer(
    Effect.gen(function* PaymentProviderConfigurationRpcsLive() {
      const paymentProviderConfigurationService =
        yield* PaymentProviderConfigurationService;
      return {
        CreatePaymentProviderConfiguration: (input) =>
          paymentProviderConfigurationService.createPaymentProviderConfiguration(
            input
          ),
        DeletePaymentProviderConfiguration: (input) =>
          paymentProviderConfigurationService.deletePaymentProviderConfiguration(
            input
          ),
        GetPaymentProviderConfiguration: ({ id }) =>
          Effect.gen(function* GetPaymentProviderConfiguration() {
            return yield* paymentProviderConfigurationService.getPaymentProviderConfigurationById(
              id
            );
          }),
        ListPaymentProviderConfigurations: ({ projectId }) =>
          Effect.gen(function* ListPaymentProviderConfigurations() {
            return yield* paymentProviderConfigurationService.getPaymentProviderConfigurations(
              projectId
            );
          }),
        UpdatePaymentProviderConfiguration: (input) =>
          paymentProviderConfigurationService.updatePaymentProviderConfiguration(
            input
          ),
      };
    })
  ).pipe(Layer.provide(PaymentProviderConfigurationService.Default));
