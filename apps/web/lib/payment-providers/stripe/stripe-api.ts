import { createPaymentProviderApi } from "@/lib/core/payment-providers/payment-provider-api";
// import { registerStripeWebhook } from "./api/webhook";
import { App } from "@/lib/api/hono/app";

export const stripeApi = createPaymentProviderApi({
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	registerEndpoints: (app: App) => {
		// registerStripeWebhook(app);
	},
});
