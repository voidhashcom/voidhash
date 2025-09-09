import { Layer } from 'effect';
import {
  type PlatformInfo,
  PlatformProvider
} from '../platform/platform-provider';

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

export const ReactNativePlatformProvider = (
  platformInfo: Partial<PlatformInfo> = {}
) =>
  Layer.succeed(PlatformProvider, {
    ...defaultTestPlatformInfo,
    ...platformInfo
  });
