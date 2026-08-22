import { Platform } from "react-native";
import { NitroModules } from "react-native-nitro-modules";

import type { GoogleBilling as GoogleBillingSpec } from "./specs/android/GoogleBilling.nitro";
import type { PaywallPresenter as PaywallPresenterSpec } from "./specs/PaywallPresenter.nitro";
import type { Storekit as StorekitSpec } from "./specs/ios/Storekit.nitro";
import type { VoidhashEngine as VoidhashEngineSpec } from "./specs/VoidhashEngine.nitro";

export const Storekit: StorekitSpec | undefined = Platform.select({
  android: undefined,
  ios: () => NitroModules.createHybridObject<StorekitSpec>("Storekit"),
})?.();

export const GoogleBilling: GoogleBillingSpec | undefined = Platform.select({
  android: () => NitroModules.createHybridObject<GoogleBillingSpec>("GoogleBilling"),
  ios: undefined,
})?.();

export const PaywallPresenter: PaywallPresenterSpec | undefined = Platform.select({
  android: () => NitroModules.createHybridObject<PaywallPresenterSpec>("PaywallPresenter"),
  ios: () => NitroModules.createHybridObject<PaywallPresenterSpec>("PaywallPresenter"),
})?.();

let voidhashEngine: VoidhashEngineSpec | undefined | null = null;

/**
 * The embedded native engine, when this platform ships one. Resolved lazily and
 * defensively: a missing native implementation (old installed binary, JS-only
 * environment) yields `undefined` so callers can fall back to the TS transport.
 */
export const getVoidhashEngine = (): VoidhashEngineSpec | undefined => {
  if (voidhashEngine !== null) {
    return voidhashEngine;
  }
  // oxlint-disable effect/noTryCatch -- a missing native implementation signals "not installed" by throwing; there is no non-throwing probe.
  try {
    const engine = NitroModules.createHybridObject<VoidhashEngineSpec>("VoidhashEngine");
    voidhashEngine = engine;
    return engine;
  } catch {
    voidhashEngine = undefined;
    return undefined;
  }
  // oxlint-enable effect/noTryCatch
};
