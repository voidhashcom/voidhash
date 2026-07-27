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

interface ReactNativeSdkHeaders {
  readonly "x-client-bundle-id": string;
  readonly "x-client-locale"?: string | undefined;
  readonly "x-client-version"?: string | undefined;
  readonly "x-distinct-id": string;
  readonly "x-is-backgrounded": "false" | "true";
  readonly "x-is-debug-build": "false" | "true";
  readonly "x-nonce": string;
  readonly "x-observer-mode": "false" | "true";
  readonly "x-platform": string;
  readonly "x-platform-brand"?: string | undefined;
  readonly "x-platform-device"?: string | undefined;
  readonly "x-platform-flavor": "browser" | "native";
  readonly "x-platform-flavor-version"?: string | undefined;
  readonly "x-platform-version"?: string | undefined;
  readonly "x-preferred-locales"?: string | undefined;
  readonly "x-publishable-key": string;
  readonly "x-sdk": "web" | "react-native";
  readonly "x-sdk-version": string;
  readonly "x-storefront"?: string | undefined;
}

export const getCommonSdkHeaders = (): Effect.Effect<
  Omit<ReactNativeSdkHeaders, "x-distinct-id">,
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
      locales.length > 0 ? locales.map((locale) => locale.languageTag).join(",") : undefined;
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
