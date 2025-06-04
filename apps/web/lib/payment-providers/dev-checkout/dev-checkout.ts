import { z } from "zod";
import { BasePaymentProvider } from "../core/base-payment-provider";
import { PaymentProvider } from "../core/payment-provider";
import {
	PaymentProviderConfigurationSheetSection,
	PaymentProviderProductEditorSheetSection,
} from "../core/types";

export const devCheckoutPaymentProviderId = "dev-checkout" as const;

const devCheckoutGlobalConfigurationSchema = z.object({});

const devCheckoutProductConfigurationSchema = z.object({});

export class DevCheckoutPaymentProvider
	extends BasePaymentProvider<typeof devCheckoutPaymentProviderId>
	implements
		PaymentProvider<
			typeof devCheckoutPaymentProviderId,
			typeof devCheckoutGlobalConfigurationSchema,
			typeof devCheckoutProductConfigurationSchema
		>
{
	constructor() {
		super(devCheckoutPaymentProviderId, "Dev Checkout", ["testing"]);
	}
	getIsConfigurable(): boolean {
		return false;
	}
	getDefaultGlobalConfiguration(): Partial<
		z.infer<typeof devCheckoutGlobalConfigurationSchema>
	> {
		return {};
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
		return {};
	}
	getProductConfigurationSchema(): typeof devCheckoutProductConfigurationSchema {
		return devCheckoutProductConfigurationSchema;
	}
	getProductConfigurationSheet(): {
		sections: PaymentProviderProductEditorSheetSection[];
	} {
		return {
			sections: [],
		};
	}
	getProductKeyProperties(): string[] {
		return [];
	}

	checkIfCorrectlyConfigured(): boolean {
		return true;
	}
}

export const devCheckout = new DevCheckoutPaymentProvider();
