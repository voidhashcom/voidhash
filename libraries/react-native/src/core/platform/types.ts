export interface PlatformInfo {
  bundleId: string | null;
  locales: { languageTag: string }[];
  systemVersion: string;
  deviceName: string;
  deviceBrand: string;
  appVersion: string | undefined;
  isDebugBuild: boolean;
  platform: 'ios' | 'android';
}

export interface PlatformProvider {
  getBundleId(): string | null;
  getLocales(): { languageTag: string }[];
  getSystemVersion(): string;
  getDeviceName(): string;
  getDeviceBrand(): string;
  getAppVersion(): string | undefined;
  isDebugBuild(): boolean;
  getPlatform(): 'ios' | 'android';
  getPlatformInfo(): PlatformInfo;
}
