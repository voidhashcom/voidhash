import { z } from "zod";
import {
	CreateConfigurationSheetParams,
	CreateProductEditorSheetParams,
	PaymentProviderConfigurationSheetSection,
	PaymentProviderProductEditorSheetSection,
} from "./types";

export class PaymentProviderConfiguration<
	TGlobalConfiguration,
	TGlobalConfigurationSchema extends z.ZodSchema,
	TProductConfiguration,
	TProductConfigurationSchema extends z.ZodSchema,
> {
	// Global configuration
	/**
	 * The default global configuration is used to create a new global configuration.
	 */
	defaultGlobalConfiguration: TGlobalConfiguration;

	/**
	 * The global configuration schema is used to validate the global configuration.
	 */
	globalConfigurationSchema: TGlobalConfigurationSchema;

	/**
	 * Used to create sheet for setting up global configuration. Each payment provider will have a different sheet.
	 */
	createGlobalConfigurationSheet: (params: CreateConfigurationSheetParams) => {
		sections: PaymentProviderConfigurationSheetSection[];
	};

	// Product configurations
	/**
	 * The product key properties are used to map the payment provider product to our internal product.
	 * For example, stripe would be ["productId", "priceId"]
	 */
	productKeyProperties: string[];

	/**
	 * The default product configuration is used to create a new product configuration.
	 */
	defaultProductConfiguration: TProductConfiguration;

	/**
	 * The product configuration schema is used to validate the product configuration.
	 */
	productConfigurationSchema: TProductConfigurationSchema;

	/**
	 * Used to create sheet for setting up product configuration. Each payment provider will have a different sheet.
	 */
	createProductEditorSheet: (params: CreateProductEditorSheetParams) => {
		sections: PaymentProviderProductEditorSheetSection[];
	};

	constructor(options: {
		defaultGlobalConfiguration: TGlobalConfiguration;
		globalConfigurationSchema: TGlobalConfigurationSchema;
		createGlobalConfigurationSheet: (
			params: CreateConfigurationSheetParams
		) => {
			sections: PaymentProviderConfigurationSheetSection[];
		};
		productKeyProperties: string[];
		defaultProductConfiguration: TProductConfiguration;
		productConfigurationSchema: TProductConfigurationSchema;
		createProductEditorSheet: (params: CreateProductEditorSheetParams) => {
			sections: PaymentProviderProductEditorSheetSection[];
		};
	}) {
		this.defaultGlobalConfiguration = options.defaultGlobalConfiguration;
		this.globalConfigurationSchema = options.globalConfigurationSchema;
		this.createGlobalConfigurationSheet =
			options.createGlobalConfigurationSheet;
		this.productKeyProperties = options.productKeyProperties;
		this.defaultProductConfiguration = options.defaultProductConfiguration;
		this.productConfigurationSchema = options.productConfigurationSchema;
		this.createProductEditorSheet = options.createProductEditorSheet;
	}
}
