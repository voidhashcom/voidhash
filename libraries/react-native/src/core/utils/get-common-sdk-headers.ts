import type { SdkHeaders } from '@voidhash/api-spec';
import { Effect } from 'effect';
import { SDK_VERSION } from '../constants';
import type { IdentityManager } from '../identity/identity-manager';
import { PlatformProvider } from '../platform/platform-provider';
import { SdkConfiguration } from '../sdk-configuration';

export const getCommonSdkHeaders = (): Effect.Effect<
  Omit<typeof SdkHeaders.Type, 'x-app-user-id'>,
  never,
  PlatformProvider | SdkConfiguration | IdentityManager
> =>
  Effect.gen(function* () {
    const platformProvider = yield* PlatformProvider;
    const sdkConfig = yield* SdkConfiguration;

    const bundleId = platformProvider.bundleId ?? '';
    const appVersion = platformProvider.appVersion;

    const locales = platformProvider.locales;
    const preferredLocales =
      locales.length > 0
        ? locales.map((locale) => locale.languageTag).join(',')
        : undefined;
    const clientLocale = locales[0]?.languageTag ?? undefined;

    return {
      'x-publishable-key': sdkConfig.publishableKey,
      'x-platform': platformProvider.platform,
      'x-sdk': 'react-native',
      'x-sdk-version': SDK_VERSION,
      'x-platform-flavor': 'native',
      'x-platform-flavor-version': appVersion,
      'x-platform-version': platformProvider.systemVersion,
      'x-platform-device': platformProvider.deviceName,
      'x-platform-brand': platformProvider.deviceBrand,
      'x-preferred-locales': preferredLocales,
      'x-client-locale': clientLocale,
      'x-client-version': appVersion,
      'x-client-bundle-id': bundleId,
      'x-observer-mode': 'false',
      'x-nonce': crypto.randomUUID(),
      'x-storefront': undefined,
      'x-is-debug-build': platformProvider.isDebugBuild ? 'true' : 'false',
      'x-is-backgrounded': 'false' // Not supported, default to false
    };
  });
