import { z } from "zod";
import { PaymentProvider } from "../types";

export const stripe: PaymentProvider = {
	id: "stripe",
	title: "Stripe",
	configurationSchema: z.object({
		secretKey: z.string().min(1),
		webhookSecret: z.string().min(1),
	}),
	defaultConfiguration: {
		secretKey: "",
		webhookSecret: "",
	},
	createConfigurationSheet: () => ({
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
				text: `https://api.voidhash.com/webhooks/stripe`,
			},
		],
	}),
} satisfies PaymentProvider;
