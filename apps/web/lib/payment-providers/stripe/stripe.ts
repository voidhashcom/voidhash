import { z } from "zod";
import { API_DOMAIN } from "@voidhash/lib/constants";
import { createPaymentProvider } from "../core/payment-provider";

export const stripeProviderId = "stripe";
export const stripe = createPaymentProvider({
	id: "stripe",
	title: "Stripe",
	environments: ["production"],
	configuration: {
		configurationSchema: z.object({
			secretKey: z.string().min(1),
			webhookSecret: z.string().min(1),
		}),
		defaultConfiguration: {
			secretKey: "",
			webhookSecret: "",
		},
		createConfigurationSheet: ({ projectId }) => ({
			sections: [
				{
					key: "secretKey",
					type: "text-input",
					name: "secretKey",
					label: "Secret Key",
					input: {
						type: "text",
						placeholder: "sk_...",
					},
				},
				{
					key: "webhookSecret",
					type: "text-input",
					name: "webhookSecret",
					label: "Webhook Secret",
					input: {
						type: "text",
						placeholder: "whsec_...",
					},
				},
				{
					key: "webhookUrl",
					type: "copy-text",
					label: "Webhook URL",
					text: `${API_DOMAIN}/payment-providers/stripe/webhook/${projectId}`,
				},
			],
		}),
	},
	products: {
		keyProperties: ["productId", "priceId"],
		productConfigurationSchema: z.object({
			productId: z
				.string()
				.min(1, {
					message: "Product ID is required",
				})
				.refine((id) => id.startsWith("prod_") || id.startsWith("prod_test_"), {
					message: "Product ID must start with 'prod_' or 'prod_test_'",
				}),
			priceId: z
				.string()
				.min(1, {
					message: "Price ID is required",
				})
				.refine(
					(id) => id.startsWith("price_") || id.startsWith("price_test_"),
					{
						message: "Price ID must start with 'price_' or 'price_test_'",
					}
				),
		}),
		defaultProductConfiguration: {
			productId: "",
			priceId: "",
		},
		createProductEditorSheet: () => ({
			sections: [
				{
					key: "productId",
					type: "text-input",
					name: "productId",
					label: "Product ID",
					input: {
						type: "text",
						placeholder: "prod_...",
					},
				},
				{
					key: "priceId",
					type: "text-input",
					name: "priceId",
					label: "Price ID",
					input: {
						type: "text",
						placeholder: "price_...",
					},
				},
			],
		}),
	},
});
