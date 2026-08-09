import { AppleLogo } from "@/features/studio/projects/settings/payment-providers/logos/apple-logo";
import { z } from "zod/v3";

import { createPaymentProvider } from "./core";
import type { PaymentProviderProductEditorSheetSection } from "./types";

export const appleAppStoreGlobalConfigurationSchema = z.object({
  appAppleId: z
    .string()
    .min(1, {
      message: "App Apple ID is required",
    })
    .regex(/^[1-9]\d{0,14}$/, {
      message: "App Apple ID must be a positive numeric Apple app identifier",
    }),
  bundleId: z.string().min(1, {
    message: "Bundle ID is required",
  }),
  inAppPurchaseKeyIssuerId: z.string().min(1, {
    message: "Issuer ID is required",
  }),
  inAppPurchaseKeyId: z.string().min(1, {
    message: "Key ID is required",
  }),
  inAppPurchasePrivateKey: z.string().min(1, {
    message: "Private key is required",
  }),
  appStoreConnectApiIssuerId: z.string().min(1, {
    message: "Issuer ID is required",
  }),
  appStoreConnectApiKeyId: z.string().min(1, {
    message: "Key ID is required",
  }),
  appStoreConnectApiVendorNumber: z.string().min(1, {
    message: "Vendor Number is required",
  }),
  appleServerNotificationForwardingUrl: z
    .string()
    .url({ message: "Forwarding URL must be a valid URL" })
    .or(z.literal("")),
  appleSmallBusinessProgramStartDate: z.string().optional(),
  appleSmallBusinessProgramHasEndDate: z.boolean(),
  appleSmallBusinessProgramEndDate: z.string().optional(),
  storeKitSubscriptionOfferKey: z.string().optional(),
  storeKitTestingFrameworkCertificate: z.string().optional(),
  trackNewPurchasesFromAppleServerNotifications: z.boolean(),
});

export type AppleAppStoreGlobalConfiguration = z.infer<
  typeof appleAppStoreGlobalConfigurationSchema
>;

const appStoreProductConfigurationSchema = z.object({
  productId: z.string().min(1, {
    message: "Product ID is required",
  }),
});

export const appleAppStore = createPaymentProvider({
  defaultGlobalConfiguration: {
    appAppleId: "",
    bundleId: "",
    inAppPurchaseKeyIssuerId: "",
    inAppPurchaseKeyId: "",
    inAppPurchasePrivateKey: "",
    appStoreConnectApiIssuerId: "",
    appStoreConnectApiKeyId: "",
    appStoreConnectApiVendorNumber: "",
    appleServerNotificationForwardingUrl: "",
    appleSmallBusinessProgramStartDate: "",
    appleSmallBusinessProgramHasEndDate: false,
    appleSmallBusinessProgramEndDate: "",
    storeKitSubscriptionOfferKey: "",
    storeKitTestingFrameworkCertificate: "",
    trackNewPurchasesFromAppleServerNotifications: true,
  },
  defaultProductConfiguration: {
    productId: "",
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
  globalConfigurationSchema: appleAppStoreGlobalConfigurationSchema,
  id: "apple-app-store",
  logo: AppleLogo,
  productConfigurationKeyProperties: ["productId"],
  productConfigurationSchema: appStoreProductConfigurationSchema,
  title: "Apple App Store",
  type: "native",
});
