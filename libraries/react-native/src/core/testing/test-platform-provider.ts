import { Layer } from "effect";

import { type PlatformInfo, PlatformProvider } from "../platform/platform-provider";

const defaultTestPlatformInfo: PlatformInfo = {
  appBuild: "100",
  appName: "Voidhash Test",
  appVersion: "1.0.0",
  bundleId: "com.voidhash.test",
  deviceBrand: "Test Brand",
  deviceName: "Test Device",
  isDebugBuild: true,
  locales: [
    {
      languageTag: "en-US",
    },
  ],
  platform: "ios",
  systemVersion: "1.0.0",
};

export const ReactNativePlatformProvider = (platformInfo: Partial<PlatformInfo> = {}) =>
  Layer.succeed(PlatformProvider, {
    ...defaultTestPlatformInfo,
    ...platformInfo,
  });
