import { createPaymentProviderApi } from "@/lib/payment-providers/core/payment-provider-api";
import { registerStripeWebhook } from "./api/webhook";
import { App } from "@/lib/api/hono/app";

export const stripeApi = createPaymentProviderApi({
	registerEndpoints: (app: App) => {
		registerStripeWebhook(app);
	},
});
