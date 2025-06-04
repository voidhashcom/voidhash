import { z } from "zod";
import { createPaymentProvider } from "../core/payment-provider";

export const appStore = createPaymentProvider({
	id: "app-store",
	title: "Apple App Store",
	environments: ["production"],
	configuration: {
		configurationSchema: z.object({
			issuerId: z.string().min(1, {
				message: "Issuer ID is required",
			}),
			bundleId: z.string().min(1, {
				message: "Bundle ID is required",
			}),
			keyId: z.string().min(1, {
				message: "Key ID is required",
			}),
			privateKey: z.string().min(1, {
				message: "Private key is required",
			}),
		}),
		defaultConfiguration: {
			issuerId: "",
			bundleId: "",
			keyId: "",
			privateKey: "",
		},
		createConfigurationSheet: () => ({
			sections: [
				{
					key: "bundleId",
					type: "text-input",
					name: "bundleId",
					label: "Bundle ID",
					input: {
						type: "text",
						placeholder: "com.example.app",
					},
				},
				{
					key: "issuerId",
					type: "text-input",
					name: "issuerId",
					label: "Issuer ID",
					input: {
						type: "text",
						placeholder: "00000000-0000-0000-0000-000000000000",
					},
				},
				{
					key: "keyId",
					type: "text-input",
					name: "keyId",
					label: "Key ID",
					input: {
						type: "text",
						placeholder: "XXXXXXXXXX",
					},
				},
				{
					key: "privateKey",
					name: "privateKey",
					type: "p8-upload",
					label: "Private Key (.p8 file)",
					successMessage: "Private key was successfully attached",
				},
			],
		}),
	},
	products: {
		keyProperties: ["productId"],
		productConfigurationSchema: z.object({
			productId: z.string().min(1, {
				message: "Product ID is required",
			}),
		}),
		defaultProductConfiguration: {
			productId: "",
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
						placeholder: "example_app.1_month_subscription",
					},
				},
			],
		}),
	},
});
