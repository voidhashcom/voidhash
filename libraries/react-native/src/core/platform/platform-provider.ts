import { ServiceMap } from "effect";

export interface PlatformInfo {
  appBuild: string | undefined;
  appName: string | undefined;
  bundleId: string | null;
  locales: { languageTag: string }[];
  systemVersion: string;
  deviceName: string;
  deviceBrand: string;
  appVersion: string | undefined;
  isDebugBuild: boolean;
  platform: "ios" | "android" | "unknown";
}
export class PlatformProvider extends ServiceMap.Service<PlatformProvider, PlatformInfo>()("rn-voidhash/PlatformProvider") {}
