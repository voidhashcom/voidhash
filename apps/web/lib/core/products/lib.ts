import type { VoidhashInternalServerError } from '@voidhash/lib/constants';
import { err, ok, type Result } from 'neverthrow';
import type { z } from 'zod';
import { paymentProviders } from '@/lib/payment-providers/payment-providers';

export const createPaymentProviderKey = <
  TKey extends ReturnType<(typeof paymentProviders)[number]['getId']>,
  TConfiguration extends z.infer<
    ReturnType<
      (typeof paymentProviders)[number]['getProductConfigurationSchema']
    >
  >
>(
  paymentProviderId: TKey,
  configuration: TConfiguration
): Result<string, VoidhashInternalServerError> => {
  const paymentProvider = paymentProviders.find(
    (p) => p.getId() === paymentProviderId
  );
  if (!paymentProvider) {
    return err({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Payment provider not found',
      originalError: new Error('Payment provider not found')
    });
  }
  return ok(
    paymentProvider
      .getProductKeyProperties()
      .map((key) => configuration[key])
      .join(':')
  );
};
