import * as Effect from "effect/Effect";
import * as Arr from "effect/Array";

import { SDK_VERSION } from "../constants";
import { PlatformProvider } from "../platform/platform-provider";
import { SdkConfiguration } from "../sdk-configuration";

const getNonce = () => globalThis.crypto.randomUUID();

interface ReactNativeSdkHeaders {
  readonly "x-client-bundle-id": string;
  readonly "x-client-locale"?: string;
  readonly "x-client-version"?: string;
  readonly "x-distinct-id": string;
  readonly "x-is-backgrounded": "false";
  readonly "x-is-debug-build": "false" | "true";
  readonly "x-nonce": string;
  readonly "x-observer-mode": "false" | "true";
  readonly "x-platform": string;
  readonly "x-platform-brand"?: string;
  readonly "x-platform-device"?: string;
  readonly "x-platform-flavor": "browser" | "native";
  readonly "x-platform-flavor-version"?: string;
  readonly "x-platform-version"?: string;
  readonly "x-preferred-locales"?: string;
  readonly "x-publishable-key": string;
  readonly "x-sdk": "web" | "react-native";
  readonly "x-sdk-version": string;
  readonly "x-storefront"?: string;
  readonly "x-environment": "production" | "development";
}

export const getCommonSdkHeaders = (): Effect.Effect<
  Omit<ReactNativeSdkHeaders, "x-distinct-id">,
  never,
  PlatformProvider | SdkConfiguration
> =>
  Effect.gen(function* getCommonSdkHeaders() {
    const platformProvider = yield* PlatformProvider;
    const sdkConfig = yield* SdkConfiguration;

    const bundleId = platformProvider.bundleId ?? "";
    const { appVersion } = platformProvider;

    const { locales } = platformProvider;
    const preferredLocales = Arr.isReadonlyArrayNonEmpty(locales)
      ? locales.map((locale) => locale.languageTag).join(",")
      : undefined;
    const clientLocale = locales[0]?.languageTag ?? undefined;

    return {
      "x-client-bundle-id": bundleId,
      "x-client-locale": clientLocale,
      "x-client-version": appVersion,
      "x-is-backgrounded": "false",
      "x-is-debug-build":
        sdkConfig.developmentMode || platformProvider.isDebugBuild ? "true" : "false",
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
      "x-environment": sdkConfig.environmentMode,
    };
  });
