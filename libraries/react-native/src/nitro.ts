import { Platform } from "react-native";
import { NitroModules } from "react-native-nitro-modules";

import type { GoogleBilling as GoogleBillingSpec } from "./specs/android/GoogleBilling.nitro";
import type { PaywallPresenter as PaywallPresenterSpec } from "./specs/PaywallPresenter.nitro";
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

export const PaywallPresenter: PaywallPresenterSpec | undefined =
  Platform.select({
    android: () =>
      NitroModules.createHybridObject<PaywallPresenterSpec>("PaywallPresenter"),
    ios: () =>
      NitroModules.createHybridObject<PaywallPresenterSpec>("PaywallPresenter"),
  })?.();
