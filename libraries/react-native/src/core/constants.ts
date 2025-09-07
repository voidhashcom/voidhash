export const SDK_VERSION = '0.0.1';

export interface PlatformInfo {
  bundleId: string;
  locales: { languageTag: string }[];
  systemVersion: string;
  deviceName: string;
  deviceBrand: string;
  appVersion: string | undefined;
  isDebugBuild: boolean;
  platform: 'ios' | 'android';
}
