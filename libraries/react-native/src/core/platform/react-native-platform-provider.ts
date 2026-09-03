import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { Platform as RNPlatform } from "react-native";

import { readNativePlatformInfo } from "./native-platform";
import { PlatformProvider } from "./platform-provider";

function getPlatform(): "ios" | "android" | "unknown" {
  if (RNPlatform.OS === "ios") {
    return "ios";
  }

  if (RNPlatform.OS === "android") {
    return "android";
  }

  return "unknown";
}

/**
 * `PlatformProvider` fed by the `VoidhashPlatform` hybrid, so headers and
 * analytics properties match what the bare Swift and Kotlin SDKs report.
 */
export const ReactNativePlatformProvider = Layer.effect(
  PlatformProvider,
  Effect.map(Effect.orDie(readNativePlatformInfo), (info) => ({
    appBuild: info.appBuild,
    appName: info.appName,
    appVersion: info.appVersion,
    bundleId: info.bundleId === "" ? undefined : info.bundleId,
    deviceBrand: info.deviceBrand ?? "unknown",
    deviceName: info.deviceName ?? "unknown",
    isDebugBuild: info.isDebugBuild,
    locales: info.locales.map((languageTag) => ({ languageTag })),
    platform: getPlatform(),
    systemVersion: info.systemVersion ?? "unknown",
  })),
);
