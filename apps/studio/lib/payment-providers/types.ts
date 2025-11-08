import type { z } from 'zod/v3';

export type PaymentProvider<
  TGlobalConfigurationSchema extends z.ZodSchema,
  TProductConfigurationSchema extends z.ZodSchema
> = {
  id: string;
  title: string;
  type: 'native' | 'web-checkout';
  logo: React.ComponentType;
  globalConfigurationSchema: TGlobalConfigurationSchema;
  productConfigurationSchema: TProductConfigurationSchema;
  defaultGlobalConfiguration: z.infer<TGlobalConfigurationSchema>;
  getGlobalConfigurationSheet: (params: CreateConfigurationSheetParams) => {
    sections: PaymentProviderConfigurationSheetSection[];
  };
  productConfigurationKeyProperties: (keyof z.infer<TProductConfigurationSchema>)[];
  defaultProductConfiguration: z.infer<TProductConfigurationSchema>;
  getProductConfigurationSheet: (params: CreateProductEditorSheetParams) => {
    sections: PaymentProviderProductEditorSheetSection[];
  };
};

type PaymentProviderTextInputSection = {
  type: 'text-input';
  name: string;
  label: string;
  input: {
    type: 'text' | 'password';
    placeholder?: string;
  };
};

type PaymentProviderCopyTextSection = {
  type: 'copy-text';
  label: string;
  text: string;
};

type PaymentProviderP8UploadSection = {
  type: 'p8-upload';
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
