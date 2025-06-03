import { z } from "zod";
import { createWebCheckoutPaymentProvider } from "../core/web-checkout-payment-provider";

export const devCheckoutProviderId = "dev-checkout";
export const devCheckout = createWebCheckoutPaymentProvider({
	id: "dev-checkout",
	title: "Dev Checkout",
	environments: ["testing"],
	configuration: {
		configurationSchema: z.object({}),
		defaultConfiguration: {},
		createConfigurationSheet: () => ({
			sections: [],
		}),
	},
	products: {
		keyProperties: ["productId", "priceId"],
		productConfigurationSchema: z.object({}),
		defaultProductConfiguration: {},
		createProductEditorSheet: () => ({
			sections: [],
		}),
	},
	createCheckoutUrl: () => "https://checkout.dev-checkout.com/dev-checkout",
});
