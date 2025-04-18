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

export type PaymentProvider = {
	id: string;
	title: string;
	configuration: {
		defaultConfiguration: object;
		configurationSchema: z.ZodSchema;
		createConfigurationSheet: (params: CreateConfigurationSheetParams) => {
			sections: PaymentProviderConfigurationSheetSection[];
		};
	};
	products: {
		keyProperties: string[];
		defaultProductConfiguration: object;
		productConfigurationSchema: z.ZodSchema;
		createProductEditorSheet: (params: CreateProductEditorSheetParams) => {
			sections: PaymentProviderProductEditorSheetSection[];
		};
	};
};
