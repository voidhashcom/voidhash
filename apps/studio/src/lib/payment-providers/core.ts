import type { z } from 'zod/v3';
import type { PaymentProvider } from './types';

export const createPaymentProvider = <
  TGlobalConfigurationSchema extends z.ZodSchema,
  TProductConfigurationSchema extends z.ZodSchema
>(
  options: PaymentProvider<
    TGlobalConfigurationSchema,
    TProductConfigurationSchema
  >
) => {
  return options;
};
