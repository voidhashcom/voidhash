import type { z } from "zod/v3";

export interface PaymentProvider<
  TGlobalConfigurationSchema extends z.ZodSchema,
  TProductConfigurationSchema extends z.ZodSchema,
> {
  id: string;
  title: string;
  type: "native" | "web-checkout";
  logo: React.ComponentType;
  globalConfigurationSchema: TGlobalConfigurationSchema;
  productConfigurationSchema: TProductConfigurationSchema;
  defaultGlobalConfiguration: z.infer<TGlobalConfigurationSchema>;
  productConfigurationKeyProperties: (keyof z.infer<TProductConfigurationSchema>)[];
  defaultProductConfiguration: z.infer<TProductConfigurationSchema>;
  getProductConfigurationSheet: (params: CreateProductEditorSheetParams) => {
    sections: PaymentProviderProductEditorSheetSection[];
  };
}

interface PaymentProviderTextInputSection {
  type: "text-input";
  name: string;
  label: string;
  input: {
    type: "text" | "password";
    placeholder?: string;
  };
}

interface PaymentProviderCopyTextSection {
  type: "copy-text";
  label: string;
  text: string;
}

export interface CreateProductEditorSheetParams {
  productId: string;
}

export type PaymentProviderProductEditorSheetSection = {
  key: string;
} & (PaymentProviderTextInputSection | PaymentProviderCopyTextSection);
