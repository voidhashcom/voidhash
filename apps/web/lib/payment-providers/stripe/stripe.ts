import { z } from "zod";
import { BasePaymentProvider } from "../core/base-payment-provider";
import { PaymentProvider } from "../core/payment-provider";
import {
	PaymentProviderConfigurationSheetSection,
	PaymentProviderProductEditorSheetSection,
} from "../core/types";
import { API_DOMAIN } from "@voidhash/lib/constants";

const stripeGlobalConfigurationSchema = z.object({
	secretKey: z.string().min(1),
	webhookSecret: z.string().min(1),
});

const stripeProductConfigurationSchema = z.object({
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
		.refine((id) => id.startsWith("price_") || id.startsWith("price_test_"), {
			message: "Price ID must start with 'price_' or 'price_test_'",
		}),
});

export const stripePaymentProviderId = "stripe" as const;

export class StripePaymentProvider
	extends BasePaymentProvider<typeof stripePaymentProviderId>
	implements
		PaymentProvider<
			typeof stripePaymentProviderId,
			typeof stripeGlobalConfigurationSchema,
			typeof stripeProductConfigurationSchema
		>
{
	constructor() {
		super(stripePaymentProviderId, "Stripe", ["production"]);
	}
	getIsConfigurable(): boolean {
		return true;
	}
	getDefaultGlobalConfiguration() {
		return {
			secretKey: "",
			webhookSecret: "",
		};
	}
	getGlobalConfigurationSchema() {
		return stripeGlobalConfigurationSchema;
	}
	getGlobalConfigurationSheet({ projectId }): {
		sections: PaymentProviderConfigurationSheetSection[];
	} {
		return {
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
		};
	}
	getIsProductConfigurable(): boolean {
		return true;
	}
	getDefaultProductConfiguration() {
		return {
			productId: "",
			priceId: "",
		};
	}
	getProductConfigurationSchema() {
		return stripeProductConfigurationSchema;
	}
	getProductConfigurationSheet() {
		const sections: PaymentProviderProductEditorSheetSection[] = [
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
		];

		return {
			sections,
		};
	}
	getProductKeyProperties(): string[] {
		return ["productId", "priceId"];
	}

	checkIfCorrectlyConfigured(
		configuration: z.infer<typeof stripeProductConfigurationSchema>
	): boolean {
		// TODO: Implement
		console.log(configuration);
		return true;
	}
}

export const stripe = new StripePaymentProvider();
