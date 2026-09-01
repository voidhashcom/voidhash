import * as Context from "effect/Context";

export interface PlatformInfo {
  appBuild?: string;
  appName?: string;
  bundleId?: string;
  locales: { languageTag: string }[];
  systemVersion: string;
  deviceName: string;
  deviceBrand: string;
  appVersion?: string;
  isDebugBuild: boolean;
  platform: "ios" | "android" | "unknown";
}
export class PlatformProvider extends Context.Service<PlatformProvider, PlatformInfo>()(
  "rn-voidhash/PlatformProvider",
) {}
