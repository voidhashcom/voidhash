import { Environment } from "@voidhash/lib/constants";
import { z } from "zod";
import { PaymentProviderConfiguration } from "./payment-provider-configuration";
import { PaymentProviderProductConfiguration } from "./payment-provider-product-configuration";
import {
	CreateConfigurationSheetParams,
	CreateProductEditorSheetParams,
	PaymentProviderConfigurationSheetSection,
	PaymentProviderProductEditorSheetSection,
} from "../types";

export type PaymentProviderOptions<
	TKey extends string,
	TConfiguration,
	TProductConfiguration,
	TProductConfigurationSchema extends z.ZodSchema,
	TConfigurationSchema extends z.ZodSchema,
> = {
	id: TKey;
	title: string;
	environments: Environment[];
	configuration: PaymentProviderConfiguration<
		TConfiguration,
		TConfigurationSchema
	>;
	products: PaymentProviderProductConfiguration<
		TProductConfiguration,
		TProductConfigurationSchema
	>;
};

export class PaymentProvider<
	TKey,
	TConfiguration,
	TProductConfiguration,
	TProductConfigurationSchema extends z.ZodSchema,
	TConfigurationSchema extends z.ZodSchema,
> {
	id: TKey;
	title: string;
	environments: Environment[];
	// Configuration is optional for payment providers that don't require configuration - e.g. Dev Checkout
	configuration: PaymentProviderConfiguration<
		TConfiguration,
		TConfigurationSchema
	> | null;
	products: PaymentProviderProductConfiguration<
		TProductConfiguration,
		TProductConfigurationSchema
	>;

	constructor(
		id: TKey,
		title: string,
		environments: Environment[],
		configuration: {
			defaultConfiguration: TConfiguration;
			configurationSchema: TConfigurationSchema;
			createConfigurationSheet: (params: CreateConfigurationSheetParams) => {
				sections: PaymentProviderConfigurationSheetSection[];
			};
		} | null,
		products: {
			keyProperties: string[];
			defaultProductConfiguration: TProductConfiguration;
			productConfigurationSchema: TProductConfigurationSchema;
			createProductEditorSheet: (params: CreateProductEditorSheetParams) => {
				sections: PaymentProviderProductEditorSheetSection[];
			};
		}
	) {
		this.id = id;
		this.title = title;
		this.environments = environments;
		this.configuration = configuration
			? new PaymentProviderConfiguration(
					configuration.defaultConfiguration,
					configuration.configurationSchema,
					configuration.createConfigurationSheet
				)
			: null;
		this.products = new PaymentProviderProductConfiguration(
			products.keyProperties,
			products.defaultProductConfiguration,
			products.productConfigurationSchema,
			products.createProductEditorSheet
		);
	}

	public requiresConfiguration() {
		return this.configuration !== null;
	}

	public isAvailableInEnvironment(environment: Environment) {
		return this.environments.includes(environment);
	}

	public isCorrectlyConfigured(configuration: TConfiguration) {
		if (!this.configuration) {
			return true;
		}
		const configurationSchema = this.configuration.configurationSchema;
		const parsedConfiguration = configurationSchema.safeParse(configuration);
		return parsedConfiguration.success;
	}
}

export const createPaymentProvider = <
	TKey extends string,
	TConfiguration,
	TProductConfiguration,
	TProductConfigurationSchema extends z.ZodSchema,
	TConfigurationSchema extends z.ZodSchema,
>(
	provider: PaymentProviderOptions<
		TKey,
		TConfiguration,
		TProductConfiguration,
		TProductConfigurationSchema,
		TConfigurationSchema
	>
) =>
	new PaymentProvider(
		provider.id,
		provider.title,
		provider.environments,
		provider.configuration,
		provider.products
	);
