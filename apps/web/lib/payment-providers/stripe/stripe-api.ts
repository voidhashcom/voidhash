// import { registerStripeWebhook } from "./api/webhook";
import type { App } from '@/lib/api/hono/app';
import { createPaymentProviderApi } from '@/lib/core/payment-providers/payment-provider-api';

export const stripeApi = createPaymentProviderApi({
  // biome-ignore lint/correctness/noUnusedFunctionParameters: TODO
  registerEndpoints: (app: App) => {
    // registerStripeWebhook(app);
  }
});
