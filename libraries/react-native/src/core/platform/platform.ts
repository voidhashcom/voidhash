import Constants from 'expo-constants';
import * as Localization from 'expo-localization';
import { Platform as RNPlatform } from 'react-native';
import { UnsupportedPlatformError } from '../../errors';
import type { PlatformInfo, PlatformProvider } from './types';

export function isReactNative(): boolean {
  return true;
}

export function getBundleId(): string | null {
  const bundleId =
    Constants.expoConfig?.android?.package ||
    Constants.expoConfig?.ios?.bundleIdentifier ||
    undefined;

  if (!bundleId) {
    return null;
  }

  return bundleId;
}

export function getLocales() {
  return Localization.getLocales();
}

export function getSystemVersion(): string {
  return String(Constants.systemVersion || 'unknown');
}

export function getDeviceName(): string {
  return Constants.deviceName || 'unknown';
}

export function getDeviceBrand(): string {
  return Constants.deviceBrand || 'unknown';
}

export function getAppVersion(): string | undefined {
  return Constants.expoConfig?.version;
}

export function isDebugBuild(): boolean {
  try {
    // biome-ignore lint/correctness/noUndeclaredVariables: __DEV__ is defined by Expo
    return typeof __DEV__ !== 'undefined' && __DEV__;
  } catch {
    return false;
  }
}

export function getPlatform(): 'ios' | 'android' {
  if (RNPlatform.OS === 'ios') {
    return 'ios';
  }

  if (RNPlatform.OS === 'android') {
    return 'android';
  }

  throw new UnsupportedPlatformError(RNPlatform.OS);
}

export function getPlatformInfo(): PlatformInfo {
  return {
    bundleId: getBundleId(),
    locales: getLocales(),
    systemVersion: getSystemVersion(),
    deviceName: getDeviceName(),
    deviceBrand: getDeviceBrand(),
    appVersion: getAppVersion(),
    isDebugBuild: isDebugBuild(),
    platform: getPlatform()
  };
}

export class ReactNativePlatformProvider implements PlatformProvider {
  getBundleId(): string | null {
    return getBundleId();
  }

  getLocales(): { languageTag: string }[] {
    return getLocales();
  }

  getSystemVersion(): string {
    return getSystemVersion();
  }

  getDeviceName(): string {
    return getDeviceName();
  }

  getDeviceBrand(): string {
    return getDeviceBrand();
  }

  getAppVersion(): string | undefined {
    return getAppVersion();
  }

  isDebugBuild(): boolean {
    return isDebugBuild();
  }

  getPlatform(): 'ios' | 'android' {
    return getPlatform();
  }

  getPlatformInfo(): PlatformInfo {
    return getPlatformInfo();
  }
}
