import type z from 'zod';
import { appleAppStore } from './app-store';
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

export const paymentProviders = [appleAppStore];
