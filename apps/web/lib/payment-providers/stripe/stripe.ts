import { z } from "zod";
import { PaymentProvider } from "../types";

export const stripe = {
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
} satisfies PaymentProvider;
