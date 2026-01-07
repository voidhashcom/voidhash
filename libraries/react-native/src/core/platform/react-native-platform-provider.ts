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
  appVersion: getAppVersion(),
  bundleId: getBundleId(),
  deviceBrand: getDeviceBrand(),
  deviceName: getDeviceName(),
  isDebugBuild: isDebugBuild(),
  locales: getLocales(),
  platform: getPlatform(),
  systemVersion: getSystemVersion(),
});
