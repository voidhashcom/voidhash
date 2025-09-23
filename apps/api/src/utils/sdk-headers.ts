import type { SdkHeaders } from '@voidhash/api-spec';
import type { Schema } from 'effect';

export const getCustomerMetadataFromSdkHeaders = (
  parsedHeaders: Schema.Schema.Type<typeof SdkHeaders>
) => {
  return {
    appUserId: parsedHeaders['x-app-user-id'],
    publishableKey: parsedHeaders['x-publishable-key'],
    platform: parsedHeaders['x-platform'],
    sdk: parsedHeaders['x-sdk'],
    sdkVersion: parsedHeaders['x-sdk-version'],
    platformFlavor: parsedHeaders['x-platform-flavor'],
    platformFlavorVersion: parsedHeaders['x-platform-flavor-version'],
    platformVersion: parsedHeaders['x-platform-version'],
    platformDevice: parsedHeaders['x-platform-device'],
    platformBrand: parsedHeaders['x-platform-brand'],
    preferredLocales: parsedHeaders['x-preferred-locales'],
    clientLocale: parsedHeaders['x-client-locale'],
    clientVersion: parsedHeaders['x-client-version'],
    clientBundleId: parsedHeaders['x-client-bundle-id'],
    observerMode: parsedHeaders['x-observer-mode'],
    nonce: parsedHeaders['x-nonce'],
    storefront: parsedHeaders['x-storefront'],
    isDebugBuild: parsedHeaders['x-is-debug-build'],
    isBackgrounded: parsedHeaders['x-is-backgrounded']
  };
};
