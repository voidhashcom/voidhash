import { Platform } from "react-native";
import { NitroModules } from "react-native-nitro-modules";
import * as Option from "effect/Option";
import * as Result from "effect/Result";

import type { GoogleBilling as GoogleBillingSpec } from "./specs/android/GoogleBilling.nitro";
import type { PaywallPresenter as PaywallPresenterSpec } from "./specs/PaywallPresenter.nitro";
import type { Storekit as StorekitSpec } from "./specs/ios/Storekit.nitro";
import type { VoidhashEngine as VoidhashEngineSpec } from "./specs/VoidhashEngine.nitro";

export const Storekit = Platform.select({
  android: undefined,
  ios: () => NitroModules.createHybridObject<StorekitSpec>("Storekit"),
})?.();

export const GoogleBilling = Platform.select({
  android: () => NitroModules.createHybridObject<GoogleBillingSpec>("GoogleBilling"),
  ios: undefined,
})?.();

export const PaywallPresenter = Platform.select({
  android: () => NitroModules.createHybridObject<PaywallPresenterSpec>("PaywallPresenter"),
  ios: () => NitroModules.createHybridObject<PaywallPresenterSpec>("PaywallPresenter"),
})?.();

let voidhashEngine = Option.none<Option.Option<VoidhashEngineSpec>>();

/**
 * The embedded native engine, when this platform ships one. Resolved lazily and
 * defensively: a missing native implementation (old installed binary, JS-only
 * environment) yields `undefined` so callers can fall back to the TS transport.
 */
export const getVoidhashEngine = (): Option.Option<VoidhashEngineSpec> => {
  if (Option.isSome(voidhashEngine)) return voidhashEngine.value;
  const engine = Result.getSuccess(
    Result.try(() => NitroModules.createHybridObject<VoidhashEngineSpec>("VoidhashEngine")),
  );
  voidhashEngine = Option.some(engine);
  return engine;
};
