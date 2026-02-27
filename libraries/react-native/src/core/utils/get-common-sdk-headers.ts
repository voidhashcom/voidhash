import type { SdkHeaders } from "@voidhash/api-spec";
import { Effect } from "effect";

import { SDK_VERSION } from "../constants";
import type { IdentityManager } from "../identity/identity-manager";
import { PlatformProvider } from "../platform/platform-provider";
import { SdkConfiguration } from "../sdk-configuration";

const generateFallbackNonce = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

const getNonce = () => {
  const cryptoObject = globalThis.crypto as { randomUUID?: () => string } | undefined;
  return cryptoObject?.randomUUID?.() ?? generateFallbackNonce();
};

export const getCommonSdkHeaders = (): Effect.Effect<
  Omit<typeof SdkHeaders.Type, "x-app-user-id">,
  never,
  PlatformProvider | SdkConfiguration | IdentityManager
> =>
  Effect.gen(function* getCommonSdkHeaders() {
    const platformProvider = yield* PlatformProvider;
    const sdkConfig = yield* SdkConfiguration;

    const bundleId = platformProvider.bundleId ?? "";
    const { appVersion } = platformProvider;

    const { locales } = platformProvider;
    const preferredLocales =
      locales.length > 0
        ? locales.map((locale) => locale.languageTag).join(",")
        : undefined;
    const clientLocale = locales[0]?.languageTag ?? undefined;

    return {
      "x-client-bundle-id": bundleId,
      "x-client-locale": clientLocale,
      "x-client-version": appVersion,
      "x-is-backgrounded": "false",
      "x-is-debug-build": platformProvider.isDebugBuild ? "true" : "false",
      "x-nonce": getNonce(),
      "x-observer-mode": sdkConfig.readOnly ? "true" : "false",
      "x-platform": platformProvider.platform,
      "x-platform-brand": platformProvider.deviceBrand,
      "x-platform-device": platformProvider.deviceName,
      "x-platform-flavor": "native",
      "x-platform-flavor-version": appVersion,
      "x-platform-version": platformProvider.systemVersion,
      "x-preferred-locales": preferredLocales,
      "x-publishable-key": sdkConfig.publishableKey,
      "x-sdk": "react-native",
      "x-sdk-version": SDK_VERSION,
      "x-storefront": undefined, // Not supported, default to false
    };
  });
