import { Platform } from "react-native";
import { NitroModules } from "react-native-nitro-modules";

import type { GoogleBilling as GoogleBillingSpec } from "./specs/android/GoogleBilling.nitro";
import type { Storekit as StorekitSpec } from "./specs/ios/Storekit.nitro";

export const Storekit: StorekitSpec | undefined = Platform.select({
  android: undefined,
  ios: () => NitroModules.createHybridObject<StorekitSpec>("Storekit"),
})?.();

export const GoogleBilling: GoogleBillingSpec | undefined = Platform.select({
  android: () =>
    NitroModules.createHybridObject<GoogleBillingSpec>("GoogleBilling"),
  ios: undefined,
})?.();
