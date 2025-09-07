import { Platform } from 'react-native';
import { NitroModules } from 'react-native-nitro-modules';

import type { GoogleBilling as GoogleBillingSpec } from './specs/android/GoogleBilling.nitro';
import type { Storekit as StorekitSpec } from './specs/ios/Storekit.nitro';

export const Storekit: StorekitSpec | undefined = Platform.select({
  ios: () => NitroModules.createHybridObject<StorekitSpec>('Storekit'),
  android: undefined
})?.();

export const GoogleBilling: GoogleBillingSpec | undefined = Platform.select({
  ios: undefined,
  android: () =>
    NitroModules.createHybridObject<GoogleBillingSpec>('GoogleBilling')
})?.();
