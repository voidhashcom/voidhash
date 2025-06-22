import { z } from "zod";
import { BasePaymentProvider } from "../../services/payment-providers/core/base-payment-provider";
import { PaymentProvider } from "../../services/payment-providers/core/payment-provider";
import {
	PaymentProviderConfigurationSheetSection,
	PaymentProviderProductEditorSheetSection,
} from "../../services/payment-providers/core/types";

export const appStorePaymentProviderId = "app-store" as const;

const appStoreGlobalConfigurationSchema = z.object({
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
});

const appStoreProductConfigurationSchema = z.object({
	productId: z.string().min(1, {
		message: "Product ID is required",
	}),
});

export class AppStorePaymentProvider
	extends BasePaymentProvider<
		typeof appStorePaymentProviderId,
		typeof appStoreGlobalConfigurationSchema,
		typeof appStoreProductConfigurationSchema
	>
	implements
		PaymentProvider<
			typeof appStorePaymentProviderId,
			typeof appStoreGlobalConfigurationSchema,
			typeof appStoreProductConfigurationSchema
		>
{
	constructor() {
		super(
			appStorePaymentProviderId,
			"App Store",
			["production"],
			["bundleId"] as const,
			["productId"] as const,
			"native"
		);
	}
	getIsConfigurable(): boolean {
		return true;
	}
	getDefaultGlobalConfiguration(): Partial<
		z.infer<typeof appStoreGlobalConfigurationSchema>
	> {
		return {
			issuerId: "",
			bundleId: "",
			keyId: "",
			privateKey: "",
		};
	}
	getGlobalConfigurationSchema(): typeof appStoreGlobalConfigurationSchema {
		return appStoreGlobalConfigurationSchema;
	}
	getGlobalConfigurationSheet(): {
		sections: PaymentProviderConfigurationSheetSection[];
	} {
		return {
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
		};
	}
	getIsProductConfigurable(): boolean {
		return true;
	}
	getDefaultProductConfiguration(): Partial<
		z.infer<typeof appStoreProductConfigurationSchema>
	> {
		return {
			productId: "",
		};
	}
	getProductConfigurationSchema(): typeof appStoreProductConfigurationSchema {
		return appStoreProductConfigurationSchema;
	}
	getProductConfigurationSheet(): {
		sections: PaymentProviderProductEditorSheetSection[];
	} {
		return {
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
		};
	}

	checkIfCorrectlyConfigured(
		// configuration: z.infer<typeof appStoreProductConfigurationSchema>
	): boolean {
		return true;
	}
}

export const appStore = new AppStorePaymentProvider();
