import { z } from "zod";
import { BasePaymentProvider } from "../../services/payment-providers/core/base-payment-provider";
import { PaymentProvider } from "../../services/payment-providers/core/payment-provider";
import {
	PaymentProviderConfigurationSheetSection,
	PaymentProviderProductEditorSheetSection,
} from "../../services/payment-providers/core/types";
import { Environment } from "@voidhash/lib/index";

export const devCheckoutPaymentProviderId = "dev-checkout" as const;

const devCheckoutGlobalConfigurationSchema = z.object({
	paymentProviderConfigurationId: z.string().min(1),
});

const devCheckoutProductConfigurationSchema = z.object({
	productId: z.string().min(1),
});

export class DevCheckoutPaymentProvider
	extends BasePaymentProvider<
		typeof devCheckoutPaymentProviderId,
		typeof devCheckoutGlobalConfigurationSchema,
		typeof devCheckoutProductConfigurationSchema
	>
	implements
		PaymentProvider<
			typeof devCheckoutPaymentProviderId,
			typeof devCheckoutGlobalConfigurationSchema,
			typeof devCheckoutProductConfigurationSchema
		>
{
	constructor() {
		super(
			devCheckoutPaymentProviderId,
			"Dev Checkout",
			[Environment.Testing],
			["paymentProviderConfigurationId"],
			["productId"],
			"web-checkout"
		);
	}
	getIsConfigurable(): boolean {
		return false;
	}
	getDefaultGlobalConfiguration(): Partial<
		z.infer<typeof devCheckoutGlobalConfigurationSchema>
	> {
		return {
			paymentProviderConfigurationId: "",
		};
	}
	getGlobalConfigurationSchema(): typeof devCheckoutGlobalConfigurationSchema {
		return devCheckoutGlobalConfigurationSchema;
	}
	getGlobalConfigurationSheet(): {
		sections: PaymentProviderConfigurationSheetSection[];
	} {
		return {
			sections: [],
		};
	}
	getIsProductConfigurable(): boolean {
		return false;
	}
	getDefaultProductConfiguration(): Partial<
		z.infer<typeof devCheckoutProductConfigurationSchema>
	> {
		return {
			productId: "",
		};
	}
	getProductConfigurationSchema(): typeof devCheckoutProductConfigurationSchema {
		return devCheckoutProductConfigurationSchema;
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
						placeholder: "prod_...",
					},
				},
			],
		};
	}

	checkIfCorrectlyConfigured(): boolean {
		return true;
	}
}

export const devCheckout = new DevCheckoutPaymentProvider();
