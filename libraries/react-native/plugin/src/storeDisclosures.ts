import type { VoidhashExpoPluginOptions } from "./withVoidhashReactNative";

export interface StoreDisclosureInputs {
  readonly apple: {
    readonly collectedData: ReadonlyArray<string>;
    readonly tracking: boolean;
  };
  readonly googlePlay: {
    readonly collectedData: ReadonlyArray<string>;
    readonly advertisingId: boolean;
    readonly deletionSupported: true;
    readonly encryptedInTransit: true;
  };
}

/** Derives mobile-store disclosure inputs from the same enabled capability options as the plugin. */
export const generateStoreDisclosureInputs = (
  options: VoidhashExpoPluginOptions,
): StoreDisclosureInputs => {
  const notifications = options.notifications?.enabled === true;
  const iosAdvertising = options.measurement?.ios?.privacyMode !== "strict-no-idfa" &&
    options.measurement?.ios?.requireAdvertisingId === true;
  const androidAdvertising = options.measurement?.android?.advertisingIdPermission === "include";
  const common = ["product-interaction", "device-or-other-identifiers"];
  return {
    apple: {
      collectedData: [...common, ...(notifications ? ["push-token"] : []), ...(iosAdvertising ? ["advertising-identifier"] : [])].sort(),
      tracking: iosAdvertising,
    },
    googlePlay: {
      collectedData: [...common, ...(notifications ? ["push-token"] : []), ...(androidAdvertising ? ["advertising-identifier"] : [])].sort(),
      advertisingId: androidAdvertising,
      deletionSupported: true,
      encryptedInTransit: true,
    },
  };
};
