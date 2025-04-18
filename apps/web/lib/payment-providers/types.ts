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

type PaymentProviderConfigurationSheetSection = {
	key: string;
} & (
	| PaymentProviderTextInputSection
	| PaymentProviderCopyTextSection
	| PaymentProviderP8UploadSection
);

export type CreateConfigurationSheetParams = {
	projectId: string;
};

export type PaymentProvider = {
	id: string;
	title: string;
	defaultConfiguration: object;
	configurationSchema: z.ZodSchema;
	createConfigurationSheet: (params: CreateConfigurationSheetParams) => {
		sections: PaymentProviderConfigurationSheetSection[];
	};
};
