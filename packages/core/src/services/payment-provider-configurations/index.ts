import { Effect } from 'effect';
import { createPaymentProviderConfiguration } from './create-payment-provider-configuration';
import { deletePaymentProviderConfiguration } from './delete-payment-provider-configuration';
import { getPaymentProviderConfigurationById } from './get-payment-provider-configuration-by-id';
import { getPaymentProviderConfigurations } from './get-payment-provider-configurations';
import { updatePaymentProviderConfiguration } from './update-payment-provider-configuration';

export class PaymentProviderConfigurationService extends Effect.Service<PaymentProviderConfigurationService>()(
  'PaymentProviderConfigurationService',
  {
    dependencies: [],
    effect: Effect.gen(function* () {
      return {
        createPaymentProviderConfiguration:
          yield* createPaymentProviderConfiguration,
        getPaymentProviderConfigurations:
          yield* getPaymentProviderConfigurations,
        getPaymentProviderConfigurationById:
          yield* getPaymentProviderConfigurationById,
        updatePaymentProviderConfiguration:
          yield* updatePaymentProviderConfiguration,
        deletePaymentProviderConfiguration:
          yield* deletePaymentProviderConfiguration
      } as const;
    })
  }
) {}

