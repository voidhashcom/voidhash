import { Context } from 'effect';

export type PlatformInfo = {
  bundleId: string | null;
  locales: { languageTag: string }[];
  systemVersion: string;
  deviceName: string;
  deviceBrand: string;
  appVersion: string | undefined;
  isDebugBuild: boolean;
  platform: 'ios' | 'android' | 'unknown';
};
export class PlatformProvider extends Context.Tag(
  'rn-voidhash/PlatformProvider'
)<PlatformProvider, PlatformInfo>() {}
