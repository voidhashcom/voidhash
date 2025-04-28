import { App } from "@/lib/api/hono/app";
import { createPaymentProviderApi } from "../types";
import { registerStripeWebhook } from "./api/webhook";

export const stripeApi = createPaymentProviderApi({
	registerEndpoints: (app: App) => {
		registerStripeWebhook(app);
	},
});
