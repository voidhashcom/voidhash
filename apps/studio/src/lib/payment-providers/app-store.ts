import { AppleLogo } from "src/features/projects/settings/payment-providers/logos/apple-logo";
import { z } from "zod/v3";

import { createPaymentProvider } from "./core";
import type {
  PaymentProviderConfigurationSheetSection,
  PaymentProviderProductEditorSheetSection,
} from "./types";

const appStoreGlobalConfigurationSchema = z.object({
  bundleId: z.string().min(1, {
    message: "Bundle ID is required",
  }),
  issuerId: z.string().min(1, {
    message: "Issuer ID is required",
  }),
  keyId: z.string().min(1, {
    message: "Key ID is required",
  }),
  privateKey: z.string().min(1, {
    message: "Private key is required",
  }),
});

const appStoreProductConfigurationSchema = z.object({
  productId: z.string().min(1, {
    message: "Product ID is required",
  }),
});

export const appleAppStore = createPaymentProvider({
  defaultGlobalConfiguration: {
    bundleId: "",
    issuerId: "",
    keyId: "",
    privateKey: "",
  },
  defaultProductConfiguration: {
    productId: "",
  },
  getGlobalConfigurationSheet(): {
    sections: PaymentProviderConfigurationSheetSection[];
  } {
    return {
      sections: [
        {
          input: {
            placeholder: "com.example.app",
            type: "text",
          },
          key: "bundleId",
          label: "Bundle ID",
          name: "bundleId",
          type: "text-input",
        },
        {
          input: {
            placeholder: "00000000-0000-0000-0000-000000000000",
            type: "text",
          },
          key: "issuerId",
          label: "Issuer ID",
          name: "issuerId",
          type: "text-input",
        },
        {
          input: {
            placeholder: "XXXXXXXXXX",
            type: "text",
          },
          key: "keyId",
          label: "Key ID",
          name: "keyId",
          type: "text-input",
        },
        {
          key: "privateKey",
          label: "Private Key (.p8 file)",
          name: "privateKey",
          successMessage: "Private key was successfully attached",
          type: "p8-upload",
        },
      ],
    };
  },
  getProductConfigurationSheet(): {
    sections: PaymentProviderProductEditorSheetSection[];
  } {
    return {
      sections: [
        {
          input: {
            placeholder: "example_app.1_month_subscription",
            type: "text",
          },
          key: "productId",
          label: "Product ID",
          name: "productId",
          type: "text-input",
        },
      ],
    };
  },
  globalConfigurationSchema: appStoreGlobalConfigurationSchema,
  id: "apple-app-store",
  logo: AppleLogo,
  productConfigurationKeyProperties: ["productId"],
  productConfigurationSchema: appStoreProductConfigurationSchema,
  title: "Apple App Store",
  type: "native",
});
