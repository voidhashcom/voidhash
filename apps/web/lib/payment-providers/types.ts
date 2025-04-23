import { z } from "zod";

type PaymentProviderTextInputSection = {
	type: "text-input";
	name: string;
	label: string;
	input: {
		type: "text" | "password";
		placeholder?: string;
	};
};

type PaymentProviderCopyTextSection = {
	type: "copy-text";
	label: string;
	text: string;
};

type PaymentProviderP8UploadSection = {
	type: "p8-upload";
	name: string;
	label: string;
	successMessage: string;
};

export type CreateConfigurationSheetParams = {
	projectId: string;
};

type PaymentProviderConfigurationSheetSection = {
	key: string;
} & (
	| PaymentProviderTextInputSection
	| PaymentProviderCopyTextSection
	| PaymentProviderP8UploadSection
);

export type CreateProductEditorSheetParams = {
	productId: string;
};

type PaymentProviderProductEditorSheetSection = {
	key: string;
} & (PaymentProviderTextInputSection | PaymentProviderCopyTextSection);

export type PaymentProvider<
	TKey,
	TConfiguration,
	TProductConfiguration,
	TProductConfigurationSchema extends z.ZodSchema,
	TConfigurationSchema extends z.ZodSchema,
> = {
	id: TKey;
	title: string;
	configuration: {
		defaultConfiguration: TConfiguration;
		configurationSchema: TConfigurationSchema;
		createConfigurationSheet: (params: CreateConfigurationSheetParams) => {
			sections: PaymentProviderConfigurationSheetSection[];
		};
	};
	products: {
		keyProperties: string[];
		defaultProductConfiguration: TProductConfiguration;
		productConfigurationSchema: TProductConfigurationSchema;
		createProductEditorSheet: (params: CreateProductEditorSheetParams) => {
			sections: PaymentProviderProductEditorSheetSection[];
		};
	};
};

export type Simplify<T> = { [KeyType in keyof T]: T[KeyType] } & {};

export const createPaymentProvider = <
	TKey extends string,
	TConfiguration,
	TProductConfiguration,
	TProductConfigurationSchema extends z.ZodSchema,
	TConfigurationSchema extends z.ZodSchema,
>(
	provider: PaymentProvider<
		TKey,
		TConfiguration,
		TProductConfiguration,
		TProductConfigurationSchema,
		TConfigurationSchema
	>
): Simplify<
	PaymentProvider<
		TKey,
		TConfiguration,
		TProductConfiguration,
		TProductConfigurationSchema,
		TConfigurationSchema
	>
> => provider;
