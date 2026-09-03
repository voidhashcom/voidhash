import type { HybridObject } from "react-native-nitro-modules";

/**
 * Host app and device metadata as the bare-native SDKs read it: `Bundle` and
 * `ProcessInfo` on iOS, `PackageManager` and `Build` on Android.
 */
export interface NativePlatformInfo {
  /** Bundle identifier (iOS) or application id (Android). */
  bundleId: string;
  /** `CFBundleVersion` / `versionCode`. */
  appBuild?: string;
  /** Display name of the host app. */
  appName?: string;
  /** `CFBundleShortVersionString` / `versionName`. */
  appVersion?: string;
  /** Operating system version. */
  systemVersion?: string;
  /** Device manufacturer. */
  deviceBrand?: string;
  /** Device model identifier. */
  deviceName?: string;
  /** Preferred locales as BCP 47 language tags, most preferred first. */
  locales: string[];
  /** Whether the host app is a debug build. */
  isDebugBuild: boolean;
  /**
   * URL schemes the host app registers: `CFBundleURLTypes` on iOS, the
   * `com.voidhash.sdk.scheme` manifest meta-data (written by the config plugin)
   * on Android. Empty when the app declares none.
   */
  urlSchemes: string[];
}

/**
 * Exposes the bare-native SDKs' platform metadata to the React Native SDK, so
 * the headers and analytics properties it reports match a pure-native
 * integration without going through Expo's config.
 */
export interface VoidhashPlatform extends HybridObject<{
  ios: "swift";
  android: "kotlin";
}> {
  /** Reads the metadata of the running app and device. */
  getInfo(): NativePlatformInfo;
}
