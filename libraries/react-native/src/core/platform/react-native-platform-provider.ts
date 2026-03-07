import { Layer } from "effect";
import Constants from "expo-constants";
import * as Localization from "expo-localization";
import { Platform as RNPlatform } from "react-native";

import { PlatformProvider } from "./platform-provider";

function getBundleId(): string | null {
  const bundleId =
    Constants.expoConfig?.android?.package ||
    Constants.expoConfig?.ios?.bundleIdentifier ||
    undefined;

  if (!bundleId) {
    return null;
  }

  return bundleId;
}

function getLocales() {
  return Localization.getLocales();
}

function getSystemVersion(): string {
  return String(Constants.systemVersion || "unknown");
}

function getDeviceName(): string {
  return Constants.deviceName || "unknown";
}

function getDeviceBrand(): string {
  return Constants.deviceBrand || "unknown";
}

function getAppVersion(): string | undefined {
  return Constants.expoConfig?.version;
}

function getAppBuild(): string | undefined {
  const iosBuild = Constants.expoConfig?.ios?.buildNumber;
  if (iosBuild) {
    return iosBuild;
  }

  const androidBuildNumber = Constants.expoConfig?.android?.versionCode;
  if (typeof androidBuildNumber === "number") {
    return String(androidBuildNumber);
  }

  return undefined;
}

function getAppName(): string | undefined {
  return Constants.expoConfig?.name;
}

function isDebugBuild(): boolean {
  try {
    // biome-ignore lint/correctness/noUndeclaredVariables: __DEV__ is defined by Expo
    return typeof __DEV__ !== "undefined" && __DEV__;
  } catch {
    return false;
  }
}

function getPlatform(): "ios" | "android" | "unknown" {
  if (RNPlatform.OS === "ios") {
    return "ios";
  }

  if (RNPlatform.OS === "android") {
    return "android";
  }

  return "unknown";
}

export const ReactNativePlatformProvider = Layer.succeed(PlatformProvider, {
  appBuild: getAppBuild(),
  appName: getAppName(),
  appVersion: getAppVersion(),
  bundleId: getBundleId(),
  deviceBrand: getDeviceBrand(),
  deviceName: getDeviceName(),
  isDebugBuild: isDebugBuild(),
  locales: getLocales(),
  platform: getPlatform(),
  systemVersion: getSystemVersion(),
});
