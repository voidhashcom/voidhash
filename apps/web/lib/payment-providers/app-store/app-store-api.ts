import type { App } from '@/lib/api/hono/app';
import { createPaymentProviderApi } from '@/lib/core/payment-providers/payment-provider-api';
import { registerAppStoreValidateTransaction } from './api/app-store_validateTransaction';
export const appStoreApi = createPaymentProviderApi({
  registerEndpoints: (app: App) => {
    registerAppStoreValidateTransaction(app);
  }
});
