import type { PlatformInfo, PlatformProvider } from '../platform/types';

const defaultTestPlatformInfo: PlatformInfo = {
  bundleId: 'com.voidhash.test',
  locales: [
    {
      languageTag: 'en-US'
    }
  ],
  systemVersion: '1.0.0',
  deviceName: 'Test Device',
  deviceBrand: 'Test Brand',
  appVersion: '1.0.0',
  isDebugBuild: true,
  platform: 'ios'
};

export class TestPlatformProvider implements PlatformProvider {
  private platformInfo: PlatformInfo;
  constructor(platformInfo: Partial<PlatformInfo> = {}) {
    this.platformInfo = {
      ...defaultTestPlatformInfo,
      ...platformInfo
    };
  }

  getBundleId(): string | null {
    return this.platformInfo.bundleId;
  }
  getLocales(): { languageTag: string }[] {
    return this.platformInfo.locales;
  }
  getSystemVersion(): string {
    return this.platformInfo.systemVersion;
  }
  getDeviceName(): string {
    return this.platformInfo.deviceName;
  }
  getDeviceBrand(): string {
    return this.platformInfo.deviceBrand;
  }
  getAppVersion(): string | undefined {
    return this.platformInfo.appVersion;
  }
  isDebugBuild(): boolean {
    return this.platformInfo.isDebugBuild;
  }
  getPlatform(): 'ios' | 'android' {
    return this.platformInfo.platform;
  }
  getPlatformInfo(): PlatformInfo {
    return this.platformInfo;
  }
}
