import type { SdkHeaders } from "@voidhash/api-spec";

export const getCustomerMetadataFromSdkHeaders = (
  parsedHeaders: typeof SdkHeaders.Type
) => ({
  appUserId: parsedHeaders["x-app-user-id"],
  clientBundleId: parsedHeaders["x-client-bundle-id"],
  clientLocale: parsedHeaders["x-client-locale"],
  clientVersion: parsedHeaders["x-client-version"],
  isBackgrounded: parsedHeaders["x-is-backgrounded"],
  isDebugBuild: parsedHeaders["x-is-debug-build"],
  nonce: parsedHeaders["x-nonce"],
  observerMode: parsedHeaders["x-observer-mode"],
  platform: parsedHeaders["x-platform"],
  platformBrand: parsedHeaders["x-platform-brand"],
  platformDevice: parsedHeaders["x-platform-device"],
  platformFlavor: parsedHeaders["x-platform-flavor"],
  platformFlavorVersion: parsedHeaders["x-platform-flavor-version"],
  platformVersion: parsedHeaders["x-platform-version"],
  preferredLocales: parsedHeaders["x-preferred-locales"],
  publishableKey: parsedHeaders["x-publishable-key"],
  sdk: parsedHeaders["x-sdk"],
  sdkVersion: parsedHeaders["x-sdk-version"],
  storefront: parsedHeaders["x-storefront"],
});
