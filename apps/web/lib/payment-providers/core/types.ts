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

export type PaymentProviderConfigurationSheetSection = {
	key: string;
} & (
	| PaymentProviderTextInputSection
	| PaymentProviderCopyTextSection
	| PaymentProviderP8UploadSection
);

export type CreateProductEditorSheetParams = {
	productId: string;
};

export type PaymentProviderProductEditorSheetSection = {
	key: string;
} & (PaymentProviderTextInputSection | PaymentProviderCopyTextSection);

export type Simplify<T> = { [KeyType in keyof T]: T[KeyType] } & {};

// export const createPaymentProviderApi = (api: {
// 	registerEndpoints: (app: App) => void;
// }) => {
// 	return api;
// };
