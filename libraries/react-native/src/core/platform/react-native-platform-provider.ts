import * as P from "effect/Predicate";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import Constants from "expo-constants";
import * as Localization from "expo-localization";
import { Platform as RNPlatform } from "react-native";

import { PlatformProvider } from "./platform-provider";

function getBundleId() {
  const bundleId =
    Constants.expoConfig?.android?.package ||
    Constants.expoConfig?.ios?.bundleIdentifier ||
    undefined;

  if (!bundleId) {
    return undefined;
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

function getAppVersion() {
  return Constants.expoConfig?.version;
}

function getAppBuild() {
  const iosBuild = Constants.expoConfig?.ios?.buildNumber;
  if (iosBuild) {
    return iosBuild;
  }

  const androidBuildNumber = Constants.expoConfig?.android?.versionCode;
  if (P.isNumber(androidBuildNumber)) {
    return String(androidBuildNumber);
  }

  return undefined;
}

function getAppName() {
  return Constants.expoConfig?.name;
}

function isDebugBuild(): boolean {
  return Result.try({
    // __DEV__ is defined by Expo
    try: () => !P.isUndefined(__DEV__) && __DEV__,
    catch: (error) => error,
  }).pipe(Result.getOrElse(() => false));
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
