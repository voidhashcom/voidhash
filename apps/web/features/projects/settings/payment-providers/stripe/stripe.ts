import { z } from "zod";
import { PaymentProvider } from "../../../../payment-providers/lib/types";
import { StripeLogo } from "./stripe-logo";

export const stripe = {
	id: "stripe",
	title: "Stripe",
	logo: StripeLogo,
	configurationSchema: z.object({
		secretKey: z.string().min(1),
		webhookSecret: z.string().min(1),
	}),
} satisfies PaymentProvider;
