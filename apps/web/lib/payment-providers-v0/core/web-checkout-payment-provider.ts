import { z } from "zod";
import { PaymentProvider } from "./payment-provider";
import { PaymentProviderOptions } from "./payment-provider";

type WebCheckoutPaymentProviderOptions<
	TKey extends string,
	TConfiguration,
	TProductConfiguration,
	TProductConfigurationSchema extends z.ZodSchema,
	TConfigurationSchema extends z.ZodSchema,
> = PaymentProviderOptions<
	TKey,
	TConfiguration,
	TProductConfiguration,
	TProductConfigurationSchema,
	TConfigurationSchema
> & {
	createCheckoutUrl: () => string;
};

export class WebCheckoutPaymentProvider<
	TKey extends string,
	TConfiguration,
	TProductConfiguration,
	TProductConfigurationSchema extends z.ZodSchema,
	TConfigurationSchema extends z.ZodSchema,
> extends PaymentProvider<
	TKey,
	TConfiguration,
	TProductConfiguration,
	TProductConfigurationSchema,
	TConfigurationSchema
> {
	createCheckoutUrl: () => string;

	constructor(
		provider: WebCheckoutPaymentProviderOptions<
			TKey,
			TConfiguration,
			TProductConfiguration,
			TProductConfigurationSchema,
			TConfigurationSchema
		>
	) {
		super(
			provider.id,
			provider.title,
			provider.environments,
			provider.configuration,
			provider.products
		);
		this.createCheckoutUrl = provider.createCheckoutUrl;
	}
}

export function createWebCheckoutPaymentProvider<
	TKey extends string,
	TConfiguration,
	TProductConfiguration,
	TProductConfigurationSchema extends z.ZodSchema,
	TConfigurationSchema extends z.ZodSchema,
>(
	provider: WebCheckoutPaymentProviderOptions<
		TKey,
		TConfiguration,
		TProductConfiguration,
		TProductConfigurationSchema,
		TConfigurationSchema
	>
) {
	return new WebCheckoutPaymentProvider(provider);
}
