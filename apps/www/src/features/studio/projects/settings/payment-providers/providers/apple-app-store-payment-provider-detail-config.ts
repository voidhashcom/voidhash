import {
  appleAppStore,
  type AppleAppStoreGlobalConfiguration,
} from "@/features/studio/lib/payment-providers/app-store";

export type AppStoreTabId =
  | "app-details"
  | "in-app-purchase-key"
  | "app-store-connect-api"
  | "apple-server-notification"
  | "apple-small-business-program"
  | "development"
  | "voidhash";

export interface AppleAppStorePaymentProviderDetailTab {
  fields: (keyof AppleAppStoreGlobalConfiguration)[];
  id: AppStoreTabId;
  label: string;
}

type AppleAppStoreStoredConfiguration = Partial<
  AppleAppStoreGlobalConfiguration & {
    issuerId: string;
    keyId: string;
    privateKey: string;
  }
>;

export const APPLE_APP_STORE_TABS: AppleAppStorePaymentProviderDetailTab[] = [
  {
    fields: ["bundleId", "appAppleId"],
    id: "app-details",
    label: "App Details",
  },
  {
    fields: ["inAppPurchaseKeyIssuerId", "inAppPurchaseKeyId", "inAppPurchasePrivateKey"],
    id: "in-app-purchase-key",
    label: "In-app purchase key",
  },
  {
    fields: [
      "appStoreConnectApiIssuerId",
      "appStoreConnectApiKeyId",
      "appStoreConnectApiVendorNumber",
    ],
    id: "app-store-connect-api",
    label: "App Store Connect API",
  },
  {
    fields: ["appleServerNotificationForwardingUrl"],
    id: "apple-server-notification",
    label: "Apple Server notification",
  },
  {
    fields: ["appleSmallBusinessProgramStartDate"],
    id: "apple-small-business-program",
    label: "Apple Small Business Program",
  },
  {
    fields: ["storeKitSubscriptionOfferKey", "storeKitTestingFrameworkCertificate"],
    id: "development",
    label: "Development",
  },
  {
    fields: [],
    id: "voidhash",
    label: "Configuration",
  },
];

export const APPLE_APP_STORE_FIELD_LABELS: Record<keyof AppleAppStoreGlobalConfiguration, string> =
  {
    appAppleId: "App Apple ID",
    appStoreConnectApiIssuerId: "Issuer ID",
    appStoreConnectApiKeyId: "Key ID",
    appStoreConnectApiVendorNumber: "Vendor Number",
    appleServerNotificationForwardingUrl: "Apple Server Notification Forwarding URL",
    appleSmallBusinessProgramEndDate: "End date",
    appleSmallBusinessProgramHasEndDate: "End date enabled",
    appleSmallBusinessProgramStartDate: "Start date",
    bundleId: "App Bundle ID",
    inAppPurchaseKeyId: "Key ID",
    inAppPurchaseKeyIssuerId: "Issuer ID",
    inAppPurchasePrivateKey: "P8 key file",
    storeKitSubscriptionOfferKey: "StoreKit Subscription Offer key",
    storeKitTestingFrameworkCertificate: "StoreKit testing framework",
    trackNewPurchasesFromAppleServerNotifications:
      "Track purchases from Apple Server Notifications",
  };

const APPLE_APP_STORE_GUIDE_BASE = "guides/payment-providers/apple-app-store";

/**
 * Maps Apple App Store configuration fields to the documentation guide slug
 * shown by the "Where to find?" sheet. Fields without a guide are omitted.
 * Slugs match the public docs path at `/docs/<slug>`.
 */
export const APPLE_APP_STORE_FIELD_GUIDES: Partial<
  Record<keyof AppleAppStoreGlobalConfiguration, string>
> = {
  appAppleId: `${APPLE_APP_STORE_GUIDE_BASE}/app-apple-id`,
  appStoreConnectApiIssuerId: `${APPLE_APP_STORE_GUIDE_BASE}/app-store-connect-api`,
  appStoreConnectApiKeyId: `${APPLE_APP_STORE_GUIDE_BASE}/app-store-connect-api`,
  appStoreConnectApiVendorNumber: `${APPLE_APP_STORE_GUIDE_BASE}/app-store-connect-api`,
  appleServerNotificationForwardingUrl: `${APPLE_APP_STORE_GUIDE_BASE}/apple-server-notifications`,
  appleSmallBusinessProgramEndDate: `${APPLE_APP_STORE_GUIDE_BASE}/apple-small-business-program`,
  appleSmallBusinessProgramStartDate: `${APPLE_APP_STORE_GUIDE_BASE}/apple-small-business-program`,
  bundleId: `${APPLE_APP_STORE_GUIDE_BASE}/bundle-id`,
  inAppPurchaseKeyId: `${APPLE_APP_STORE_GUIDE_BASE}/in-app-purchase-key`,
  inAppPurchaseKeyIssuerId: `${APPLE_APP_STORE_GUIDE_BASE}/in-app-purchase-key`,
  inAppPurchasePrivateKey: `${APPLE_APP_STORE_GUIDE_BASE}/in-app-purchase-key`,
  storeKitSubscriptionOfferKey: `${APPLE_APP_STORE_GUIDE_BASE}/storekit-subscription-offer-key`,
  storeKitTestingFrameworkCertificate: `${APPLE_APP_STORE_GUIDE_BASE}/storekit-testing-certificate`,
};

/**
 * Builds the Apple App Store Server Notifications endpoint URL from an API origin or `/api` base.
 */
export function getAppleServerToServerNotificationUrl({
  apiUrl,
  paymentProviderConfigurationId,
}: {
  apiUrl: string;
  paymentProviderConfigurationId: string;
}): string {
  const normalizedApiUrl = apiUrl.replace(/\/+$/, "");
  const normalizedApiBaseUrl = normalizedApiUrl.endsWith("/api")
    ? normalizedApiUrl
    : `${normalizedApiUrl}/api`;
  return `${normalizedApiBaseUrl}/v1/webhook-endpoints/apple-server-to-server/${paymentProviderConfigurationId}`;
}

const OPTIONAL_FIELDS = new Set<keyof AppleAppStoreGlobalConfiguration>([
  "appleServerNotificationForwardingUrl",
  "appleSmallBusinessProgramStartDate",
  "appleSmallBusinessProgramHasEndDate",
  "appleSmallBusinessProgramEndDate",
  "storeKitSubscriptionOfferKey",
  "storeKitTestingFrameworkCertificate",
  "trackNewPurchasesFromAppleServerNotifications",
]);

export function isAppleAppStoreOptionalField(
  field: keyof AppleAppStoreGlobalConfiguration,
  _values?: AppleAppStoreGlobalConfiguration,
): boolean {
  return OPTIONAL_FIELDS.has(field);
}

export function getAppleAppStoreInitialConfiguration(
  configuration: AppleAppStoreStoredConfiguration | null | undefined,
): AppleAppStoreGlobalConfiguration {
  const storedConfiguration = configuration ?? {};

  return {
    ...appleAppStore.defaultGlobalConfiguration,
    ...getLegacyConfigurationValues(storedConfiguration),
    ...getSmallBusinessProgramConfigurationValues(storedConfiguration),
    ...storedConfiguration,
  };
}

function getLegacyConfigurationValues(
  configuration: AppleAppStoreStoredConfiguration,
): Partial<AppleAppStoreGlobalConfiguration> {
  return {
    appStoreConnectApiIssuerId: configuration.issuerId,
    appStoreConnectApiKeyId: configuration.keyId,
    inAppPurchaseKeyIssuerId: configuration.issuerId,
    inAppPurchaseKeyId: configuration.keyId,
    inAppPurchasePrivateKey: configuration.privateKey,
  };
}

function getSmallBusinessProgramConfigurationValues(
  configuration: Partial<AppleAppStoreGlobalConfiguration>,
): Partial<AppleAppStoreGlobalConfiguration> {
  if (typeof configuration.appleSmallBusinessProgramHasEndDate === "boolean") {
    return {};
  }

  return {
    appleSmallBusinessProgramHasEndDate: Boolean(configuration.appleSmallBusinessProgramEndDate),
  };
}
